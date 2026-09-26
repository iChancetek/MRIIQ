"""
FastAPI application — REST API for the MRI Prior Authorization system.
All OpenAI API calls happen server-side. The frontend never receives OPENAI_API_KEY.
"""
import uuid
import base64
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles

from backend.app.models.extraction import (
    AuthRequest, ReviewRequest, AuthResponse, FinalOutcomeResponse,
    RagRequest, RagResponse,
)
from backend.app.graph.workflow import workflow_graph, rag_graph
from backend.app.agents.tts import speak_recommendation
from backend.app.agents.rag import query_clinical_rag

app = FastAPI(
    title="MRI Prior Authorization API",
    version="1.0.0",
    description="Deterministic prior authorization with LangGraph + OpenAI gpt-5.6-terra + MCP",
)

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://mriiq.fit:3000",
    "https://mriiq.fit",
    "https://www.mriiq.fit",
    "https://mriiq--quantiq221.us-east4.hosted.app",
    "https://api.mriiq.fit",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|.*mriiq\.fit|.*hosted\.app)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_MOCK_PDFS_DIR = Path(__file__).resolve().parents[2] / "data" / "mock-pdfs"
if _MOCK_PDFS_DIR.exists():
    app.mount("/mock-pdfs", StaticFiles(directory=str(_MOCK_PDFS_DIR)), name="mock-pdfs")


@app.get("/health")
def health():
    return {"status": "ok", "service": "mri-prior-auth"}


@app.post("/api/authorize", response_model=AuthResponse)
def authorize(req: AuthRequest):
    """
    Phase 1: Run the workflow up to the human-review interrupt.
    Returns the extracted facts and proposed recommendation for review.
    """
    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}

    initial_state = {
        "patient_id": req.patient_id,
        "clinical_note": req.clinical_note,
    }

    # Run up to interrupt_before=["human_review"]
    snapshot = workflow_graph.invoke(initial_state, config)

    state = snapshot if isinstance(snapshot, dict) else snapshot.__dict__

    return AuthResponse(
        thread_id=thread_id,
        patient=state.get("patient", {}),
        pain_weeks=state.get("pain_weeks"),
        physio_weeks=state.get("physio_weeks"),
        recommendation=state.get("recommendation", ""),
        denial_reasons=state.get("denial_reasons", []),
        error=state.get("error", ""),
    )


@app.post("/api/review", response_model=FinalOutcomeResponse)
def review(req: ReviewRequest):
    """
    Phase 2: Resume the interrupted workflow with the human reviewer's decision.
    Returns the final outcome string.
    """
    config = {"configurable": {"thread_id": req.thread_id}}

    resume_decision = "yes" if req.decision.lower() in ("yes", "y", "approve") else "no"

    # Resume the graph by updating state and invoking to completion
    workflow_graph.update_state(config, {"human_decision": resume_decision})
    result = workflow_graph.invoke(None, config)
    state = result if isinstance(result, dict) else result.__dict__
    final = state.get("final_outcome", "Unknown outcome")

    return FinalOutcomeResponse(final_outcome=final)


@app.post("/api/tts")
def text_to_speech(recommendation: str, denial_reasons: list[str] = None):
    """
    Optional TTS endpoint — returns MP3 audio of the recommendation.
    Accessibility feature only; does not change the authorization decision.
    """
    denial_reasons = denial_reasons or []
    audio_bytes = speak_recommendation(recommendation, denial_reasons)
    return Response(content=audio_bytes, media_type="audio/mpeg")


from backend.app.models.extraction import (
    AuthRequest, ReviewRequest, AuthResponse, FinalOutcomeResponse,
    RagRequest, RagResponse, MemoryUpdateRequest, MemoryListResponse,
)
from backend.app.agents.rag import (
    query_clinical_rag, load_long_term_memories, add_patient_memory
)


@app.post("/api/rag", response_model=RagResponse)
def rag_endpoint(req: RagRequest):
    """
    RAG endpoint querying SOAP clinical documentation with Dual Memory in Python.
    - Short-Term Memory: conversation history within the current session.
    - Long-Term Memory: persistent patient clinical memory bank.
    """
    return query_clinical_rag(
        patient_id=req.patient_id,
        question=req.question,
        short_term_history=req.short_term_history,
        custom_memories=req.custom_memories,
    )


@app.get("/api/rag/memories", response_model=MemoryListResponse)
def get_memories_endpoint(patient_id: str = "P001"):
    """
    Retrieve persistent long-term memories for a patient.
    """
    memories = load_long_term_memories(patient_id)
    return MemoryListResponse(patient_id=patient_id, memories=memories)


@app.post("/api/rag/memories", response_model=MemoryListResponse)
def add_memory_endpoint(req: MemoryUpdateRequest):
    """
    Add a new persistent long-term memory for a patient.
    """
    updated = add_patient_memory(req.patient_id, req.memory)
    return MemoryListResponse(patient_id=req.patient_id, memories=updated)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
