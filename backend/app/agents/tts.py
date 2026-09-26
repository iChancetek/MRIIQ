"""
TTS Agent — generates spoken audio for the proposed recommendation/reason.
Uses OpenAI TTS. Output is MP3 bytes returned to the caller.
TTS is an accessibility/output feature only — it does NOT change the decision.
"""
from openai import OpenAI
from backend.app.config import OPENAI_API_KEY, OPENAI_TTS_MODEL, OPENAI_TTS_VOICE

_client = OpenAI(api_key=OPENAI_API_KEY)


def speak_recommendation(recommendation: str, denial_reasons: list[str]) -> bytes:
    """
    Convert the proposed recommendation to speech.
    Returns raw MP3 bytes.
    """
    if recommendation == "APPROVE":
        text = (
            "Proposed recommendation: Approve. "
            "The plan is active and both required durations meet the six-week requirement."
        )
    else:
        reasons_text = " ".join(denial_reasons)
        text = (
            f"Proposed recommendation: Deny. "
            f"The following criteria were not met: {reasons_text}"
        )

    response = _client.audio.speech.create(
        model=OPENAI_TTS_MODEL,
        voice=OPENAI_TTS_VOICE,
        input=text,
    )
    return response.content
