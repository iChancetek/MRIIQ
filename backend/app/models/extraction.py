"""
Pydantic models used across the application.
"""
from typing import Optional
from pydantic import BaseModel


class ClinicalExtraction(BaseModel):
    """Validated output from the OpenAI reader/extraction step."""
    pain_weeks: Optional[float] = None
    physio_weeks: Optional[float] = None


class AuthRequest(BaseModel):
    """Frontend → Backend: initiate an authorization workflow."""
    patient_id: str
    clinical_note: str


class ReviewRequest(BaseModel):
    """Frontend → Backend: submit human reviewer decision."""
    patient_id: str
    decision: str  # "yes" | "no"
    thread_id: str


class AuthResponse(BaseModel):
    """Backend → Frontend: initial workflow result (before human review)."""
    thread_id: str
    patient: dict
    pain_weeks: Optional[float]
    physio_weeks: Optional[float]
    recommendation: str
    denial_reasons: list[str]
    error: str = ""


class FinalOutcomeResponse(BaseModel):
    """Backend → Frontend: final outcome after human review."""
    final_outcome: str
