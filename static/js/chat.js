let websocket;
let recorder;
let isRecording = false;
let audioBlob;
let username = "";
let startTime;
let timerInterval;
const modalElement = document.getElementById("joinModal");
const modal = new bootstrap.Modal(modalElement);
// Establish WebSocket connection as soon as the page loads
window.onload = function () {
  connectWebSocket();
  let isRecording = false;
  toggleSubmitButton("disable");
  modal.show();
};
document.getElementById("recordButton").addEventListener("click", async () => {
  if (isRecording) {
    // Stop recording
    recorder.stop();
    isRecording = false;
    clearInterval(timerInterval);
    toggleSubmitButton("disable");
    document.getElementById("recordButton").innerText = "mic_off";
  } else {
    // Start recording
    document.getElementById("recordButton").innerText = "mic";
    await startRecording();
    isRecording = true;
    toggleSubmitButton("enable");
  }
});
document.getElementById("submit_btn").addEventListener("click", async () => {
  recorder.stop();
  document.getElementById("recordButton").innerText = "mic_off";
  toggleSubmitButton("disable");
  clearInterval(timerInterval);
  document.getElementById("timer").textContent = "00:00";
});
document.getElementById("joinButton").addEventListener("click", () => {
  username = document.getElementById("usernameInput").value.trim();
  console.log("usrnme", username);
  if (username) {
    // Close the join modal
    //new bootstrap.Modal(document.getElementById('joinModal')).hide();
    // Send the join event to the server
    websocket.send(
      JSON.stringify({
        type: "join",
        username: username,
      })
    );
    modal.hide();
  } else {
    alert("Please enter a username.");
  }
});

function toggleSubmitButton(status) {
  const submitButton = document.getElementById("submit_btn");
  if (status === "enable") {
    submitButton.disabled = false;
    if (submitButton.classList.contains("disable")) {
      submitButton.classList.remove("disabled");
    }
  } else {
    submitButton.disabled = true;
    submitButton.classList.add("disabled");
  }
}

function addTranscriptedMessage(message, user) {
  console.log(user, username);
  const messagesDiv = document.getElementById("messages");
  const messageDiv = document.createElement("div");
  const chatText = document.createElement("div");
  const text = document.createElement("div");
  const name = document.createElement("div");
  chatText.style.width = "auto";
  chatText.style.padding = "5px 10px";
  chatText.style.textAlign = "left";
  chatText.style.borderRadius = "5px";
  name.style.color = "blue";
  name.style.fontSize = "14px";
  text.style.fontSize = "14px";

  messageDiv.classList.add("mb-2");

  if (user === "System") {
    chatText.style.textAlign = "center";
    chatText.style.margin = "0 auto";
    user = "";
  } else if (user === username) {
    user = "You";
    console.log("...1");
    chatText.style.float = "right";
    chatText.style.backgroundColor = "#ADD8E6";
  } else {
    chatText.style.float = "left";
    chatText.style.backgroundColor = "#f1f1f1";
  }

  text.innerHTML = `${message}`;
  name.innerHTML = `${user}`;
  chatText.appendChild(name);
  chatText.appendChild(text);
  messageDiv.appendChild(chatText);
  messagesDiv.appendChild(messageDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
// Connect to WebSocket server
function connectWebSocket() {
  console.log(WebSocket);
  websocket = new WebSocket("ws://127.0.0.1:8080/chat");
  websocket.onopen = () => console.log("WebSocket connected");
  websocket.onclose = () => console.log("WebSocket disconnected");
  websocket.onmessage = (event) => {
    console.log(event.data);
    const data = JSON.parse(event.data);
    console.log(data);
    // Update transcription in real-time as the server sends transcriptions
    addTranscriptedMessage(data["message"], data["username"]);
  };
}

function convertBlobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(",")[1]); // Base64 string without the data URL prefix
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
// Start recording as soon as the page loads and continuously send data to the server
async function startRecording() {
  startTime = Date.now();
  timerInterval = setInterval(updateTimer, 1000);
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
  });
  recorder = new MediaRecorder(stream);
  recorder.ondataavailable = (event) => {
    audioBlob = event.data;
  };
  recorder.onstop = async (event) => {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      console.log("audioBlob", audioBlob);
      const base64Audio = await convertBlobToBase64(audioBlob);
      // Send audio data to WebSocket server
      //websocket.send(audioBlob);
      websocket.send(
        JSON.stringify({
          type: "message",
          username: username,
          audioBlob: base64Audio,
        })
      );
    }
  };
  recorder.start(); // Collect data every 100ms
}

function updateTimer() {
  const elapsed = Date.now() - startTime;
  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);
  document.getElementById("timer").textContent = `${pad(minutes)}:${pad(
    seconds
  )}`;
}
function pad(number) {
  return number < 10 ? "0" + number : number;
}
