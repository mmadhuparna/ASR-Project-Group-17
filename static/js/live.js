let mediaRecorder;
        let ws;
        let audioChunks = [];
        let recording = false;
        let timerInterval;
        let startTime;

        document.getElementById('recordButton').addEventListener("click", async () => {
            if(!recording){
            startRecording();
            
            document.getElementById("recordButton").innerText = "mic"
            }
            else{
                stopRecording();
                document.getElementById("recordButton").innerText = "mic_off"
            }
        })

        function startRecording() {
            startTime = Date.now();
            timerInterval = setInterval(updateTimer, 1000);
            console.log(audioChunks)
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
                    mediaRecorder.ondataavailable = (event) => {
                        audioChunks.push(event.data);
                        if (recording) {
                            sendAudioChunks();
                        }
                    };
                    mediaRecorder.onstop = () => {
                        audioChunks = []
                        console.log("Recording stopped");
                    };
                    mediaRecorder.start(500);  // Record in small chunks (every second)
                    recording = true;

                    // Connect to WebSocket server
                    ws = new WebSocket("ws://127.0.0.1:8080/live");

                    ws.onopen = () => {
                        console.log("Recording starts");
                    };

                    ws.onmessage = (event) => {
                        document.getElementById("messages").innerText = event.data;
                    };
                });
        }

        function stopRecording() {
            if (mediaRecorder) {
                mediaRecorder.stop();
                recording = false;           
            }
            clearInterval(timerInterval);
        }

        function sendAudioChunks() {
            const blob = new Blob(audioChunks, { type: "audio/wav" });
            const reader = new FileReader();
            reader.onloadend = () => {
                const arrayBuffer = reader.result;
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(arrayBuffer);
                }
            };
            reader.readAsArrayBuffer(blob);
            audioChunks = [];  // Clear the chunks after sending
        }

        function updateTimer() {
            const elapsed = Date.now() - startTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            document.getElementById('timer').textContent = `${pad(minutes)}:${pad(seconds)}`;
        }
        function pad(number) {
            return number < 10 ? '0' + number : number;
        }