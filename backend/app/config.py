"""
Application config — loaded from .env / environment variables.
"""
import os
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-5.6-terra")
OPENAI_TTS_MODEL: str = os.getenv("OPENAI_TTS_MODEL", "tts-1-hd")
OPENAI_TTS_VOICE: str = os.getenv("OPENAI_TTS_VOICE", "onyx")

if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY is not set. Add it to .env before running.")

if OPENAI_MODEL != "gpt-5.6-terra":
    raise RuntimeError(
        f"OPENAI_MODEL is '{OPENAI_MODEL}' but this project requires 'gpt-5.6-terra'. "
        "Update OPENAI_MODEL in your .env file."
    )
