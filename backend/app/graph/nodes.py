"""
LangGraph workflow nodes — each node performs one step and returns
a partial AuthState dict that LangGraph merges into the shared state.
"""
from typing import Any
from backend.app.graph.state import AuthState
from backend.app.mcp.client import get_patient, get_rule
from backend.app.agents.reader import extract_from_note
from backend.app.agents.decision import make_decision
from backend.app.agents.rag import query_clinical_rag


# ── Node 1: Fetch patient data via MCP ──────────────────────────────────────
def node_fetch_patient(state: AuthState) -> dict:
    patient = get_patient(state.patient_id)
    rule = get_rule()
    if "error" in patient:
        return {"error": patient["error"], "patient": {}, "rule": rule}
    return {"patient": patient, "rule": rule}


# ── Node 2: Extract clinical facts via OpenAI ────────────────────────────────
def node_extract(state: AuthState) -> dict:
    if state.error:
        return {}
    extraction = extract_from_note(state.clinical_note)
    return {
        "pain_weeks": extraction.pain_weeks,
        "physio_weeks": extraction.physio_weeks,
        "extraction_raw": str(extraction.model_dump()),
    }


# ── Node 3: Deterministic authorization decision ─────────────────────────────
def node_decide(state: AuthState) -> dict:
    if state.error:
        return {"recommendation": "DENY", "denial_reasons": ["System error: " + state.error]}

    plan_active = state.patient.get("plan_active", False)
    min_pain = state.rule.get("min_pain_weeks", 6)
    min_physio = state.rule.get("min_physio_weeks", 6)

    recommendation, denial_reasons = make_decision(
        plan_active=plan_active,
        pain_weeks=state.pain_weeks,
        physio_weeks=state.physio_weeks,
        min_pain_weeks=min_pain,
        min_physio_weeks=min_physio,
    )
    return {"recommendation": recommendation, "denial_reasons": denial_reasons}


# ── Node 4: Agentic Clinical RAG Assistant ──────────────────────────────────
def node_rag_assistant(state: AuthState) -> dict:
    """
    RAG Agentic Node: When a query is provided, retrieves the patient's
    SOAP documentation and grounds the clinical answer in SOAP sections.
    """
    if not state.rag_query:
        return {}
    rag_res = query_clinical_rag(state.patient_id, state.rag_query)
    return {
        "rag_answer": rag_res.answer,
        "rag_cited_section": rag_res.cited_section,
        "rag_evidence": rag_res.evidence,
    }


# ── Node 5: Apply human review (HITL) ───────────────────────────────────────
def node_apply_review(state: AuthState) -> dict:
    decision = (state.human_decision or "").strip().lower()
    if decision in ("yes", "y", "approve", "approved"):
        return {"final_outcome": f"Decision approved by reviewer - Recommendation: {state.recommendation}"}
    return {"final_outcome": "Decision rejected by reviewer"}
