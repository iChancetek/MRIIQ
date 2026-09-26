"""
Reader Agent — uses OpenAI structured extraction (gpt-5.6-terra) to pull
pain_weeks and physio_weeks from the clinical note.

Rules enforced in the system prompt:
  - Extract ONLY explicitly stated durations.
  - Never invent missing durations.
  - "No physiotherapy was tried" → physio_weeks = 0
  - Physiotherapy mentioned without duration → physio_weeks = null
  - Absent physiotherapy → physio_weeks = null
"""
import json
from openai import OpenAI
from backend.app.config import OPENAI_API_KEY, OPENAI_MODEL
from backend.app.models.extraction import ClinicalExtraction

_client = OpenAI(api_key=OPENAI_API_KEY)

_SYSTEM_PROMPT = """You are a clinical-note extraction assistant.
Your ONLY job is to read the provided clinical note and extract exactly two fields:
  - pain_weeks:   integer or float — how many weeks of back pain are explicitly documented.
  - physio_weeks: integer, float, 0, or null.

Strict rules you MUST follow:
1. Extract ONLY information that is EXPLICITLY written in the note.
2. Never infer, estimate, or invent a value.
3. Never interpret another treatment (massage, chiropractic, acupuncture, etc.) as physiotherapy.
4. If the note says "No physiotherapy was tried" → physio_weeks = 0.
5. If physiotherapy is mentioned but no duration is given → physio_weeks = null.
6. If physiotherapy is completely absent from the note → physio_weeks = null.
7. Convert expressions such as "2 months" to weeks (2 months = 8 weeks).

Respond with a valid JSON object only, no explanation:
{"pain_weeks": <number or null>, "physio_weeks": <number or null>}
"""


def extract_from_note(clinical_note: str) -> ClinicalExtraction:
    """Call OpenAI and return a validated ClinicalExtraction."""
    response = _client.chat.completions.create(
        model=OPENAI_MODEL,
        max_completion_tokens=256,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": f"Clinical Note:\n{clinical_note}"},
        ],
    )
    raw_text = response.choices[0].message.content.strip()
    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError:
        # If the model returned something unexpected, default to nulls
        data = {"pain_weeks": None, "physio_weeks": None}
    return ClinicalExtraction(**data)
