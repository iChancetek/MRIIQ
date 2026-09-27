"""
Pydantic models used across the application.
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


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


class RagRequest(BaseModel):
    """Frontend → Backend: query physician clinical documentation via RAG."""
    patient_id: str
    question: str
    short_term_history: Optional[List[Dict[str, str]]] = None
    custom_memories: Optional[List[str]] = None


class RagResponse(BaseModel):
    """Backend → Frontend: RAG answer grounded in SOAP notes with dual memory & security."""
    patient_id: str
    patient_name: str
    question: str
    answer: str
    cited_section: str
    evidence: List[str] = []
    recalled_long_term_memories: List[str] = []
    short_term_turns_count: int = 0
    model_used: str = "gpt-5.6-terra"
    phi_masked: bool = True
    guardrail_status: str = "passed"  # "passed" | "blocked"
    compliance: Dict[str, Any] = Field(
        default_factory=lambda: {
            "hipaa_safe_harbor": True,
            "gdpr_article_17": True,
            "audit_logged": True,
        }
    )


class MemoryUpdateRequest(BaseModel):
    """Frontend → Backend: add a memory to patient's long-term store."""
    patient_id: str
    memory: str


class MemoryListResponse(BaseModel):
    """Backend → Frontend: retrieve long-term memories for a patient."""
    patient_id: str
    memories: List[str]


class PurgeMemoryResponse(BaseModel):
    """Backend → Frontend: response after purging patient memories under GDPR Article 17."""
    success: bool = True
    patient_id: str
    message: str
    timestamp: str
    compliance: Dict[str, Any] = Field(
        default_factory=lambda: {
            "gdpr_article_17": True,
            "audit_logged": True,
        }
    )
