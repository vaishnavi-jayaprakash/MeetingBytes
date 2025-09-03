let mediaRecorder;
let audioChunks = [];

async function startCapture() {
  return new Promise((resolve, reject) => {
    
    chrome.tabCapture.capture({ audio: true, video: false }, (stream) => {
      if (!stream) {
        reject(new Error("No audio stream"));
        return;
      }

      mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) audioChunks.push(event.data);
      };

      mediaRecorder.start();
      resolve(true);
    });
  });
}

async function stopCaptureAndUpload() {
  return new Promise((resolve) => {
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
      chrome.runtime.sendMessage({ type: "SUMMARY_READY", error: "No recording in progress" });
      resolve();
      return;
    }
    mediaRecorder.onstop = async () => {
      const blob = new Blob(audioChunks, { type: "audio/webm" });
      chrome.runtime.sendMessage({ type: "OFFSCREEN_UPLOAD", blob });
      resolve();
    };
    mediaRecorder.stop();
  });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "OFFSCREEN_START_CAPTURE") {
    startCapture().catch((e) => {
      chrome.runtime.sendMessage({ type: "SUMMARY_READY", error: e?.message || String(e) });
    });
  }
  if (msg.type === "OFFSCREEN_STOP_CAPTURE") {
    stopCaptureAndUpload();
  }
});


