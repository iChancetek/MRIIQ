"""
LangGraph workflow — assembles nodes into a StateGraph with interrupt()
for the human-review step.

Workflow:
  fetch_patient → extract → decide → [interrupt] → apply_review → END
"""
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from backend.app.graph.state import AuthState
from backend.app.graph.nodes import (
    node_fetch_patient,
    node_extract,
    node_decide,
    node_apply_review,
)


def build_workflow() -> tuple:
    """
    Returns (compiled_graph, checkpointer).
    Workflow:
      fetch_patient -> extract -> decide -> [interrupt_before] -> apply_review -> END
    """
    checkpointer = MemorySaver()

    builder = StateGraph(AuthState)

    builder.add_node("fetch_patient", node_fetch_patient)
    builder.add_node("extract", node_extract)
    builder.add_node("decide", node_decide)
    builder.add_node("apply_review", node_apply_review)

    builder.set_entry_point("fetch_patient")
    builder.add_edge("fetch_patient", "extract")
    builder.add_edge("extract", "decide")
    builder.add_edge("decide", "apply_review")
    builder.add_edge("apply_review", END)

    graph = builder.compile(
        checkpointer=checkpointer,
        interrupt_before=["apply_review"],
    )
    return graph, checkpointer


# Singleton instances shared across the FastAPI app
workflow_graph, workflow_checkpointer = build_workflow()
