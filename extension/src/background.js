let mediaRecorder;
let audioChunks = [];

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "startCapture") {
    chrome.tabCapture.capture({ audio: true, video: false }, (stream) => {
      if (!stream) {
        sendResponse({ success: false, error: "No audio stream" });
        return;
      }

      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.start();
      sendResponse({ success: true });
    });

    return true; // async response
  }

  if (msg.action === "stopCapture") {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunks, { type: "audio/webm" });

        const formData = new FormData();
        formData.append("file", blob, "meeting_audio.webm");

        try {
          const res = await fetch("http://localhost:8000/transcribe", {
            method: "POST",
            body: formData
          });
          const data = await res.json();

          sendResponse({ success: true, summary: data.summary || "No summary" });
        } catch (err) {
          console.error("Transcription failed", err);
          sendResponse({ success: false, error: err.message });
        }
      };

      mediaRecorder.stop();
    } else {
      sendResponse({ success: false, error: "No recording in progress" });
    }

    return true; // async response
  }
});
