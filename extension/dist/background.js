let mediaRecorder;
let audioChunks = [];

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "startCapture") {
    chrome.tabCapture.capture({ audio: true, video: false }, (stream) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
        return;
      }
      if (!stream) {
        sendResponse({ success: false, error: "No audio stream. Make sure you're on a regular tab (not chrome://) with audio." });
        return;
      }

      try {
        mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      } catch (e) {
        sendResponse({ success: false, error: (e && e.message) || String(e) });
        return;
      }
      audioChunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunks.push(e.data);
      };
      mediaRecorder.start();
      chrome.storage.session.set({ mb_isRecording: true });
      sendResponse({ success: true });
    });
    return true;
  }

  if (msg.action === "stopCapture") {
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
      sendResponse({ success: false, error: "No recording in progress" });
      return true;
    }
    mediaRecorder.onstop = async () => {
      const blob = new Blob(audioChunks, { type: "audio/webm" });
      try {
        const formData = new FormData();
        formData.append("file", blob, "meeting_audio.webm");
        const res = await fetch("http://localhost:8000/transcribe", {
          method: "POST",
          body: formData
        });
        const data = await res.json();
        chrome.runtime.sendMessage({ type: "SUMMARY_READY", summary: data.summary || "No summary", pdf_base64: data.pdf_base64 });
      } catch (err) {
        chrome.runtime.sendMessage({ type: "SUMMARY_READY", error: err && err.message ? err.message : String(err) });
      }
    };
    mediaRecorder.stop();
    chrome.storage.session.set({ mb_isRecording: false });
    sendResponse({ success: true });
    return true;
  }
});
