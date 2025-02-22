let isRecording = false;
let recorder;
let audioBlob;

let transcriptElement = document.getElementById('transcript').innerText
if(transcriptElement){
    const clear = document.getElementById('clear').innerText
    clear.style.display = 'block'
}

function handleFileChange(event) {
  const fileInput = event.target;
  const fileNameDisplay = document.getElementById('file-name');
  const progressBarContainer = document.getElementById('progress-bar-container');
  const progressBar = document.getElementById('progress-bar');

  // Display file name
  const fileName = fileInput.files[0] ? fileInput.files[0].name : '';
  if (fileName) {
    fileNameDisplay.textContent = `${fileName}`;
    fileNameDisplay.style.display = 'block';
  }
}
// audio recording handling
document.getElementById("recordButton").addEventListener("click", async () => {
  if (isRecording) {
    // Stop recording
    recorder.stop();
    isRecording = false;
    document.getElementById("recordButton").textContent = "Start Recording";
  } else {
    // Start recording
    await startRecording();
    isRecording = true;
    document.getElementById("recordButton").textContent = "Stop Recording";
  }
});


// File upload handling
document
  .getElementById("fileInput")
  .addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (file) {
      // Check if the file is a .wav file
      if (file.type !== "audio/wav") {
        alert("Please upload only .wav files.");
        return;
      }
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("http://localhost:8080/transcribe/", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      console.log("File upload transcription result: ", result);
      document.getElementById('transcription').style.display = 'block'
      document.getElementById("transcript").innerText = result.transcription;
      if(result.transcription){
        document.getElementById('clear').style.display = 'block'
        document.getElementById("file-name").innerText = ""       
    }
    }
  });
async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
  });
  recorder = new MediaRecorder(stream);
  recorder.ondataavailable = (event) => {
    audioBlob = event.data;
  };
  recorder.onstop = async () => {
    // Send the recorded audio to the backend for transcription
    const formData = new FormData();
    formData.append("file", audioBlob, "audio.wav");
    const response = await fetch("http://localhost:8080/transcribe/", {
      method: "POST",
      body: formData,
    });
    const result = await response.json();
    console.log("...1", result);
     document.getElementById('transcription').style.display = 'block'
    document.getElementById("transcript").innerText = result.transcription;
    if(result.transcription){
        document.getElementById('clear').style.display = 'block'
    }
  };
  recorder.start();
}

document.getElementById('clear').addEventListener('click', (() => {
  
    document.getElementById('transcript').innerText = ''
    document.getElementById('transcription').style.display = 'none'
    document.getElementById('clear').style.display = 'none'
}))
