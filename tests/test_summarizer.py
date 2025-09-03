from backend.summarizer import summarize_text


def test_summarizer_fallback():
    text = """
    Chrome extensions record audio from the active tab. This pipeline sends the audio to a backend.
    The backend transcribes with Whisper. Then a transformer summarizes the transcript for a concise outcome.
    Finally, a PDF is generated and returned to the extension.
    """.strip()

    s = summarize_text(text)
    assert isinstance(s, str)
    assert len(s) > 0

