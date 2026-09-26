"""
LangGraph workflow state definition in Python.
"""
from __future__ import annotations
from typing import Any, Optional, List
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

    # OpenAI extraction (gpt-5.6-terra)
    pain_weeks: Optional[float] = None
    physio_weeks: Optional[float] = None
    extraction_raw: str = ""

    # Deterministic decision
    recommendation: str = ""          # "APPROVE" | "DENY"
    denial_reasons: list[str] = []

    # Agentic RAG Q&A (SOAP Clinical Documentation)
    rag_query: Optional[str] = None
    rag_answer: Optional[str] = None
    rag_cited_section: Optional[str] = None
    rag_evidence: List[str] = []

    # Human review (HITL)
    human_decision: str = ""          # "approved" | "rejected"
    final_outcome: str = ""

    # Errors
    error: str = ""

    class Config:
        arbitrary_types_allowed = True
