import base64
import io
import os
import tempfile
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from backend.whisper_transcribe import transcribe_audio_file
from backend.summarizer import summarize_text
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas


app = FastAPI(title="MeetingBytes Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _build_summary_pdf(summary_text: str) -> bytes:
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    margin = 72
    textobject = c.beginText(margin, height - margin)
    textobject.setFont("Helvetica", 12)
    for line in summary_text.split("\n"):
        # wrap long lines
        words = line.split(" ")
        current = ""
        for w in words:
            test = (current + " " + w).strip()
            if c.stringWidth(test, "Helvetica", 12) > (width - 2 * margin):
                textobject.textLine(current)
                current = w
            else:
                current = test
        if current:
            textobject.textLine(current)
        textobject.textLine("")
    c.drawText(textobject)
    c.showPage()
    c.save()
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    # Save to a temporary file for Whisper
    suffix = os.path.splitext(file.filename or "audio.webm")[1] or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        temp_path = tmp.name

    error_msg = None
    received_bytes = len(content)
    print(f"/transcribe received {received_bytes} bytes as {file.filename}")

    # Short-circuit if nothing meaningful was captured
    if received_bytes < 2000:
        summary = "No transcript available. (Audio too short or silence; received < 2 KB)"
        pdf_bytes = _build_summary_pdf(summary)
        pdf_b64 = base64.b64encode(pdf_bytes).decode("utf-8")
        try:
            os.remove(temp_path)
        except OSError:
            pass
        return JSONResponse({"summary": summary, "pdf_base64": pdf_b64, "warning": "empty_upload"})
    try:
        transcript = transcribe_audio_file(temp_path)
    except Exception as e:
        transcript = ""
        error_msg = f"transcription_error: {e}"
    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass

    if not transcript:
        error_msg = error_msg or "empty_transcript"
    summary = summarize_text(transcript or "") if transcript else "No transcript available."
    pdf_bytes = _build_summary_pdf(summary)
    pdf_b64 = base64.b64encode(pdf_bytes).decode("utf-8")

    payload = {"summary": summary, "pdf_base64": pdf_b64}
    if error_msg:
        payload["warning"] = error_msg
    return JSONResponse(payload)


@app.get("/")
def root():
    return {"status": "ok"}


