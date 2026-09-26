"""
LangGraph workflow state definition.
"""
from __future__ import annotations
from typing import Any, Optional
from pydantic import BaseModel


class AuthState(BaseModel):
    """
    Shared mutable state threaded through every LangGraph node.
    """
    # Input
    patient_id: str = ""
    clinical_note: str = ""

    # MCP data
    patient: dict = {}
    rule: dict = {}

    # OpenAI extraction
    pain_weeks: Optional[float] = None
    physio_weeks: Optional[float] = None
    extraction_raw: str = ""

    # Deterministic decision
    recommendation: str = ""          # "APPROVE" | "DENY"
    denial_reasons: list[str] = []

    # Human review
    human_decision: str = ""          # "approved" | "rejected"
    final_outcome: str = ""

    # Errors
    error: str = ""

    class Config:
        arbitrary_types_allowed = True
