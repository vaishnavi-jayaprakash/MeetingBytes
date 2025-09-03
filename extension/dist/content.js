chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "SUMMARY_READY") {
    let box = document.getElementById("meetingbytes-box");
    if (!box) {
      box = document.createElement("div");
      box.id = "meetingbytes-box";
      box.style.position = "fixed";
      box.style.bottom = "10px";
      box.style.right = "10px";
      box.style.background = "white";
      box.style.padding = "8px";
      box.style.border = "1px solid #ddd";
      box.style.zIndex = "9999";
      document.body.appendChild(box);
    }
    box.innerText = msg.summary || msg.error || "No summary available";
  }
});
