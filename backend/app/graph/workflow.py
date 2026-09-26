"""
LangGraph workflow — assembles nodes into a StateGraph with interrupt()
for the human-review step, plus RAG clinical assistant support.

Workflow:
  fetch_patient → extract → decide → rag_assistant → [interrupt] → apply_review → END
"""
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from backend.app.graph.state import AuthState
from backend.app.graph.nodes import (
    node_fetch_patient,
    node_extract,
    node_decide,
    node_rag_assistant,
    node_apply_review,
)


def build_workflow() -> tuple:
    """
    Returns (compiled_graph, checkpointer).
    Workflow:
      fetch_patient -> extract -> decide -> rag_assistant -> [interrupt_before] -> apply_review -> END
    """
    checkpointer = MemorySaver()

    builder = StateGraph(AuthState)

    builder.add_node("fetch_patient", node_fetch_patient)
    builder.add_node("extract", node_extract)
    builder.add_node("decide", node_decide)
    builder.add_node("rag_assistant", node_rag_assistant)
    builder.add_node("apply_review", node_apply_review)

    builder.set_entry_point("fetch_patient")
    builder.add_edge("fetch_patient", "extract")
    builder.add_edge("extract", "decide")
    builder.add_edge("decide", "rag_assistant")
    builder.add_edge("rag_assistant", "apply_review")
    builder.add_edge("apply_review", END)

    graph = builder.compile(
        checkpointer=checkpointer,
        interrupt_before=["apply_review"],
    )
    return graph, checkpointer


def build_rag_workflow():
    """
    Dedicated LangGraph sub-graph for agentic RAG questions grounded in SOAP documentation.
    """
    builder = StateGraph(AuthState)
    builder.add_node("rag_assistant", node_rag_assistant)
    builder.set_entry_point("rag_assistant")
    builder.add_edge("rag_assistant", END)
    return builder.compile()


# Singleton instances shared across the FastAPI app
workflow_graph, workflow_checkpointer = build_workflow()
rag_graph = build_rag_workflow()
