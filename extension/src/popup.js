import "./styles.css";

document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("root");
  if (!root) return;

  root.innerHTML = `
    <h1>MeetingBytes</h1>
    <button id="mb-start" class="start">🎙️ Start Recording</button>
    <button id="mb-stop" class="stop" style="display:none;">⏹ Stop Recording</button>
    <div id="mb-summary" class="summary-box" style="display:none;">
      <h2>Summary:</h2>
      <p id="mb-summary-text"></p>
      <a id="mb-summary-pdf" href="#" download="meeting_summary.pdf" style="display:none;">Download PDF</a>
    </div>
    <div style="margin-top:8px;"><a id="mb-open-tab" href="chrome-extension://${chrome.runtime.id}/popup.html" target="_blank">Open in tab</a></div>
  `;

  const startBtn = document.getElementById("mb-start");
  const stopBtn = document.getElementById("mb-stop");
  const summaryBox = document.getElementById("mb-summary");
  const summaryText = document.getElementById("mb-summary-text");
  const summaryPdf = document.getElementById("mb-summary-pdf");

  function setRecordingState(isRecording) {
    startBtn.style.display = isRecording ? "none" : "inline-block";
    stopBtn.style.display = isRecording ? "inline-block" : "none";
  }

  chrome.storage.session.get(["mb_isRecording"], (s) => {
    if (s && s.mb_isRecording) setRecordingState(true);
  });

  if (location.protocol === "chrome-extension:" && window.top === window) {
    // In a standalone extension tab: tabCapture cannot capture this tab.
    // Inform user to use the toolbar popup on the target page.
    summaryText.textContent = "Start must be clicked from the toolbar popup on the page you want to record (not this extension tab).";
    summaryBox.style.display = "block";
  }

  startBtn.addEventListener("click", () => {
    try {
      // If a previous capture exists, stop it cleanly first
      if (window.mb_stream && typeof window.mb_stream.getTracks === "function") {
        window.mb_stream.getTracks().forEach((t) => t.stop());
        window.mb_stream = null;
      }

      chrome.tabCapture.capture({ audio: true, video: false }, (stream) => {
        if (chrome.runtime.lastError) {
          summaryText.textContent = `Error: ${chrome.runtime.lastError.message}`;
          summaryBox.style.display = "block";
          return;
        }
        if (!stream) {
          summaryText.textContent = "Error: No audio stream. Open a normal tab with audio.";
          summaryBox.style.display = "block";
          return;
        }

        try {
          window.mb_mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
        } catch (e) {
          summaryText.textContent = `Error: ${e && e.message ? e.message : String(e)}`;
          summaryBox.style.display = "block";
          return;
        }
        window.mb_stream = stream;
        window.mb_audioChunks = [];
        window.mb_mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) window.mb_audioChunks.push(e.data);
        };
        // Use timeslice so dataavailable fires periodically and buffers flush
        window.mb_mediaRecorder.start(1000);
        chrome.storage.session.set({ mb_isRecording: true });
        setRecordingState(true);
      });
    } catch (e) {
      summaryText.textContent = `Error: ${e && e.message ? e.message : String(e)}`;
      summaryBox.style.display = "block";
    }
  });

  stopBtn.addEventListener("click", () => {
    const rec = window.mb_mediaRecorder;
    if (!rec || rec.state === "inactive") {
      setRecordingState(false);
      return;
    }
    rec.onstop = async () => {
      try {
        // Ensure any pending chunk is flushed
        if (typeof rec.requestData === "function") {
          try { rec.requestData(); } catch (_) {}
        }
        await new Promise((r) => setTimeout(r, 150));
      } catch (_) {}

      const blob = new Blob(window.mb_audioChunks || [], { type: "audio/webm" });
      try {
        const formData = new FormData();
        formData.append("file", blob, "meeting_audio.webm");
        const res = await fetch("http://localhost:8000/transcribe", { method: "POST", body: formData });
        const data = await res.json();
        if (data.summary) summaryText.textContent = data.summary;
        if (data.pdf_base64) {
          summaryPdf.href = `data:application/pdf;base64,${data.pdf_base64}`;
          summaryPdf.style.display = "inline-block";
        }
        if (data.warning) {
          console.warn("Backend warning:", data.warning);
        }
      } catch (err) {
        summaryText.textContent = `Error: ${err && err.message ? err.message : String(err)}`;
      } finally {
        summaryBox.style.display = "block";
      }
    };
    rec.stop();
    if (window.mb_stream && typeof window.mb_stream.getTracks === "function") {
      window.mb_stream.getTracks().forEach((t) => t.stop());
      window.mb_stream = null;
    }
    chrome.storage.session.set({ mb_isRecording: false });
    setRecordingState(false);
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "SUMMARY_READY") {
      if (msg.summary) {
        summaryText.textContent = msg.summary;
      } else if (msg.error) {
        summaryText.textContent = `Error: ${msg.error}`;
      } else {
        summaryText.textContent = "No summary available";
      }
      summaryBox.style.display = "block";
      if (msg.pdf_base64) {
        summaryPdf.href = `data:application/pdf;base64,${msg.pdf_base64}`;
        summaryPdf.style.display = "inline-block";
      }
    }
  });
});


