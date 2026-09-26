"""
Vision Agent — uses OpenAI vision to read text from synthetic patient document images/PDFs.
Only for synthetic documents. Never used on real patient records.
"""
import base64
from pathlib import Path
from openai import OpenAI
from backend.app.config import OPENAI_API_KEY, OPENAI_MODEL

_client = OpenAI(api_key=OPENAI_API_KEY)

_VISION_SYSTEM = """You are a synthetic-document OCR assistant.
Read the provided synthetic patient document image and extract all visible text.
This is a DEMONSTRATION document only — not a real patient record.
Return the extracted text verbatim, preserving line structure."""


def extract_text_from_image(image_path: str) -> str:
    """
    Send a synthetic image to OpenAI vision and return extracted text.
    Supports PNG, JPEG, WEBP, GIF.
    """
    path = Path(image_path)
    if not path.exists():
        raise FileNotFoundError(f"Synthetic image not found: {image_path}")

    suffix = path.suffix.lower()
    mime_map = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                ".webp": "image/webp", ".gif": "image/gif"}
    mime = mime_map.get(suffix, "image/png")

    with open(image_path, "rb") as f:
        encoded = base64.b64encode(f.read()).decode("utf-8")

    response = _client.chat.completions.create(
        model=OPENAI_MODEL,
        max_completion_tokens=1024,
        messages=[
            {"role": "system", "content": _VISION_SYSTEM},
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime};base64,{encoded}"},
                    },
                    {
                        "type": "text",
                        "text": "Extract all text from this synthetic patient document.",
                    },
                ],
            },
        ],
    )
    return response.choices[0].message.content.strip()
