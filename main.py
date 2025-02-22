# app.py
from fastapi import FastAPI, File, UploadFile, HTTPException,Form, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates
import wave
from pydantic import BaseModel
import torch
import librosa
import os
from io import BytesIO
#from pyngrok import ngrok
from typing import List 
import importlib
import subprocess
import uvicorn 
import inference
from fastapi.responses import HTMLResponse
from typing import Optional
from pydub import AudioSegment
from fastapi.staticfiles import StaticFiles
from pydub.utils import mediainfo
import json
import base64




# Dynamically import the inference module

#print(inference)

#ngrok.set_auth_token("2rpuEWk76K6NRp4DuyOVPNNhJPa_3nEnq1tF3iNoGe7e1h2BC")


# Initialize FastAPI app
app = FastAPI()

origins = [
    "http://127.0.0.1:8080",  # Allow this origin (frontend server)
    "http://localhost:8080",   # Allow localhost as well (some browsers differentiate)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # List of allowed origins
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allow all headers
)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


# Input model parameters
device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
huggingface_folder = '/Users/madhuparna/Documents/app-asr/checkpoints'  
model_path = '/Users/madhuparna/Documents/app-asr/checkpoints/best_model.tar'

clients = {}

# Initialize the Inferencer class (this will automatically load the model)
inferencer = inference.Inferencer(device=device, huggingface_folder=huggingface_folder, model_path=model_path)

# Input model to handle audio file paths
class InferenceRequest(BaseModel):
    audio_file_path: str  # Path to the audio file (.wav)
    

class TranscriptionResponse(BaseModel):
    transcription: str
    
    
async def transcribe_audio_from_bytes(audio_data: bytes) -> str:
    try:
        if len(audio_data) == 0:
            return "Error: No audio data received"
        # Save audio data to a temporary WAV file (or a buffer)
        audio_path = "/tmp/temp_audio.wav"
        with open(audio_path, "wb") as f:
            f.write(audio_data)

        audio_info = mediainfo(audio_path)
        audio_type = audio_info['codec_name']
        
        if audio_type != 'pcm_s16le':
            audio = AudioSegment.from_file(audio_path, format="webm")
            
            audio_path = audio_path.replace(".webm", ".wav")
            audio.export(audio_path, format="wav")
            print(f"Converted to WAV: {audio_path}")
    
        # Load the audio using librosa or any other method you prefer
        wav, _ = librosa.load(audio_path,sr=16000)
        
        # Transcribe using the inference model
        transcription = inferencer.transcribe(wav)
       
        return transcription
    except Exception as e:
        return f"Error processing audio: {str(e)}"
    
    
async def getTranscription(audio_chunk:bytes):
    audio_data_buffer = b""
    try:
        #audio_data_buffer += audio_chunk
        transcription = await transcribe_audio_from_bytes(audio_chunk)
        return transcription
    except:
        print("Error getting transcription")
    
@app.websocket("/live")       
async def asr_websocket(websocket: WebSocket):
    await websocket.accept()
    audio_data_buffer = b""
    while True:
        try:
           audio_data = await websocket.receive_bytes()
           audio_data_buffer += audio_data
           transcriptedText = await getTranscription( audio_data_buffer)
           
           await websocket.send_text(transcriptedText)
        except WebSocketDisconnect:
            print("Client disconnected")
            break
    
@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(file: UploadFile = File(...)):
    try:
        if file:
            print(f"File uploaded: {file.filename}, Content-Type: {file.content_type}")
            # Handle file upload
            audio_data = await file.read()
            audio_path = "/tmp/" + file.filename
            if os.path.exists(audio_path):
               print(f"File exists at {audio_path}")
            else:
               print(f"File not found at {audio_path}")       
            
            with open(audio_path, "wb") as f:
                f.write(audio_data)
                
            temp_wav_path = audio_path
                
            if file.content_type == "audio/webm;codecs=opus":
                print("Converting WebM to WAV...")
                # Convert WebM to WAV using pydub
                audio = AudioSegment.from_file(audio_path, format="webm")
                
                # Create a temporary file for the WAV output
                temp_wav_path = audio_path.replace(".webm", ".wav")
                audio.export(temp_wav_path, format="wav")
                print(f"Converted to WAV: {temp_wav_path}")
               
            # Load the audio file and transcribe
            try:
                wav, _ = librosa.load(temp_wav_path, sr=16000)
                print('Audio loaded successfully')
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Error loading audio file: {str(e)}")
            transcription = inferencer.transcribe(wav)
            return {"transcription": transcription}
    
    except Exception as e:
        print(f"Error occurred: {str(e)}")  # Log the exception
        raise HTTPException(status_code=500, detail=f"Server error during transcription: {str(e)}")

@app.websocket("/chat")
async def websocket_transcribe_audio(websocket: WebSocket):
    await websocket.accept()
    userName = None
    
    audio_data_buffer = b""
    try:
        while True:  # Replaced 'async for' with a while loop to manually receive messages
            message = await websocket.receive_text()  # Receiving message as text
            data = json.loads(message)            

            if data["type"] == "join":
                username = data["username"]
                clients[username] = websocket
                print(f"{username} joined the chat")
               
                
                # Notify other clients
                for client in clients.values():
                    if client != websocket:
                        await client.send_json({
                            "username": "System",
                            "message": f"{username} has joined the chat!"
                        })
            
            elif data["type"] == "message":
                username = data["username"]
                audioBlob = data["audioBlob"]
                audio_bytes = convert_audio_blob_to_bytes(audioBlob)
               
                # Broadcast the message to all clients
           
                for client in clients.values():
                    message = await getTranscriptionForChat(audio_bytes)                    
                    await client.send_json({
                        "username": username,
                        "message": message
                    })
                    
    except Exception as e:
        print(f"Error: {e}")
    finally:
        # Clean up when the client disconnects
        for username, client in list(clients.items()):
            if client == websocket:
                del clients[username]
                break
 
 
async def getTranscriptionForChat(audio_chunk:bytes):
    audio_data_buffer = b""
    try:
        audio_data_buffer += audio_chunk
        transcription = await transcribe_audio_from_bytes(audio_chunk)
        return transcription
    except:
        print("Error getting transcription")
        

def convert_audio_blob_to_bytes(audioBlob: str) -> bytes:
    try:
        # Decode the base64-encoded string into bytes
        audio_bytes = base64.b64decode(audioBlob)
        return audio_bytes
    except Exception as e:
        print(f"Error decoding audioBlob: {e}")
        return None
       

# Optional health check endpoint
@app.get("/")
def read_home(request: Request):
    return templates.TemplateResponse("index.html",{"request": request})
    
@app.get("/asr-live")
def read_asr(request: Request):
    return templates.TemplateResponse("live.html",{"request": request})
    
@app.get("/chatroom")
def read_asr(request: Request):
    return templates.TemplateResponse("chat.html",{"request": request})

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8080)

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8080)
