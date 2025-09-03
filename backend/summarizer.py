from typing import List
import os


_PIPELINE = None


def _load_summarizer():
    global _PIPELINE
    if _PIPELINE is not None:
        return _PIPELINE
    # Use a lightweight CNN distilbart summarizer
    try:
        from transformers import pipeline  # type: ignore

        model_name = os.getenv("MB_SUMMARY_MODEL", "sshleifer/distilbart-cnn-12-6")
        _PIPELINE = pipeline("summarization", model=model_name)
        return _PIPELINE
    except Exception:
        _PIPELINE = None
        return None


def _chunk_text(text: str, max_chars: int = 3000) -> List[str]:
    # rough chunking by characters to avoid tokenization dependency here
    chunks: List[str] = []
    start = 0
    while start < len(text):
        end = min(start + max_chars, len(text))
        chunks.append(text[start:end])
        start = end
    return chunks or [text]


def summarize_text(text: str) -> str:
    """
    Summarize text using a Hugging Face model with simple chunking.
    Falls back to a simple heuristic if model is unavailable.
    """
    text = (text or "").strip()
    if not text:
        return ""

    pipe = _load_summarizer()
    if pipe is None:
        # Fallback: first 5 sentences heuristic
        sentences = []
        buff = []
        for ch in text:
            buff.append(ch)
            if ch in ".!?" and len(buff) > 1:
                sentences.append("".join(buff).strip())
                buff = []
        if buff:
            sentences.append("".join(buff).strip())
        return "\n".join(sentences[:5]) if sentences else text

    pieces = _chunk_text(text)
    partial_summaries: List[str] = []
    for piece in pieces:
        out = pipe(piece, max_length=220, min_length=60, do_sample=False)
        partial_summaries.append(out[0]["summary_text"])  # type: ignore
    if len(partial_summaries) == 1:
        return partial_summaries[0]
    # Summarize the summaries
    combined = "\n".join(partial_summaries)
    out = pipe(combined, max_length=200, min_length=50, do_sample=False)
    return out[0]["summary_text"]  # type: ignore


