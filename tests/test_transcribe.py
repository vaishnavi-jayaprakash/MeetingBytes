import base64
from fastapi.testclient import TestClient
from backend.main import app


def test_transcribe_endpoint(monkeypatch):
    client = TestClient(app)

    def fake_transcribe_audio_file(path: str) -> str:
        return "hello world. this is a test transcript. it should be summarized."

    def fake_summarize_text(text: str) -> str:
        return "summary: hello world test."

    monkeypatch.setattr("backend.whisper_transcribe.transcribe_audio_file", fake_transcribe_audio_file)
    monkeypatch.setattr("backend.summarizer.summarize_text", fake_summarize_text)

    resp = client.post("/transcribe", files={"file": ("test.webm", b"fake-bytes", "audio/webm")})
    assert resp.status_code == 200
    data = resp.json()
    assert "summary" in data and data["summary"].startswith("summary:")
    assert "pdf_base64" in data
    # Ensure it's decodable
    base64.b64decode(data["pdf_base64"])  # noqa: not raising means ok


