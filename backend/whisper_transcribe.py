import subprocess
import tempfile
import os
import whisper
import shutil


def _run_whisper(model, input_path: str) -> str:
    # Use parameters that make the model less aggressive at skipping low-speech segments
    result = model.transcribe(
        input_path,
        fp16=False,
        language="en",
        condition_on_previous_text=False,
        no_speech_threshold=0.1,
        temperature=0.0,
        without_timestamps=True,
    )
    return result.get("text", "").strip()


def _convert_to_wav(src_path: str) -> str:
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        wav_path = tmp.name
    # Resolve ffmpeg path robustly
    env_path = os.getenv("MB_FFMPEG_PATH")
    if env_path and os.path.exists(env_path):
        ffmpeg_cmd = env_path
    else:
        which = shutil.which("ffmpeg")
        if which:
            ffmpeg_cmd = which
        else:
            raise FileNotFoundError(
                "ffmpeg not found. Set MB_FFMPEG_PATH to the full path of ffmpeg.exe or add ffmpeg to PATH."
            )
    subprocess.run([ffmpeg_cmd, "-y", "-i", src_path, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav_path],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return wav_path


def transcribe_audio_file(path: str) -> str:
    """
    Transcribe an audio/video file using OpenAI Whisper (base model).
    If the initial decode yields empty text, convert to 16k mono WAV and retry.
    """
    model = whisper.load_model("base")
    # First attempt on the original container
    try:
        text = _run_whisper(model, path)
    except Exception:
        text = ""

    if text:
        return text

    # Fallback: convert to wav and retry
    wav_path = None
    try:
        wav_path = _convert_to_wav(path)
        text = _run_whisper(model, wav_path)
        return text
    finally:
        if wav_path:
            try:
                os.remove(wav_path)
            except OSError:
                pass


