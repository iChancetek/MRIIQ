"""
STT Agent — transcribes spoken clinical audio using OpenAI Whisper (whisper-1).
Supports WEBM, WAV, MP3, MP4, M4A audio inputs.
Primed with clinical domain vocabulary (SOAP notes, CPT 72148, SLR, etc.).
"""
from io import BytesIO
from openai import OpenAI
from backend.app.config import OPENAI_API_KEY

_client = OpenAI(api_key=OPENAI_API_KEY)

CLINICAL_STT_PROMPT = (
    "Physician clinical documentation, SOAP notes, Lumbar Spine MRI, CPT 72148, "
    "radiculopathy, Straight Leg Raise test, SLR, conservative physical therapy, "
    "ICD-10 M54.16, Prior Authorization."
)


def transcribe_audio(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    """
    Transcribe raw audio bytes using OpenAI Whisper.
    Returns the transcription text string.
    """
    if not audio_bytes or len(audio_bytes) < 400:
        return ""

    audio_file = BytesIO(audio_bytes)
    audio_file.name = filename

    transcription = _client.audio.transcriptions.create(
        model="whisper-1",
        file=audio_file,
        prompt=CLINICAL_STT_PROMPT,
        language="en",
    )
    return (transcription.text or "").strip()
