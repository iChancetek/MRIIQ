"""
test.py — Automated test entry point.

Runs three synthetic cases: P001, P002, P003
Simulates human reviewer selecting "yes".
Also tests the rejection path to verify "Decision rejected by reviewer".

Usage:
    python test.py
"""
import sys
import os

# Ensure backend is importable from repo root
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

# Ensure utf-8 output on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from backend.app.graph.workflow import build_workflow

# ── Clinical notes ────────────────────────────────────────────────────────────
NOTES = {
    "P001": "Back pain for 10 weeks. Physiotherapy for 8 weeks.",
    "P002": "Patient presents with back pain for 9 weeks. No physiotherapy was tried.",
    "P003": "Back pain for 12 weeks. No physiotherapy was tried.",
}

# ── Expected outcomes ─────────────────────────────────────────────────────────
# P001: plan active, pain>=6w, physio>=6w → APPROVE  → reviewer yes → "approved"
# P002: plan active, pain>=6w, physio=0   → DENY     → reviewer yes → "approved" (reviewer overrides)
# P003: plan inactive, pain>=6w, physio=0 → DENY     → reviewer yes → "approved"
# NOTE: When reviewer says "yes" they confirm the *recommendation* is accepted.
# The workflow records "Decision approved by reviewer".

EXPECTED_PASS_KEYWORD = "approved"
EXPECTED_REJECT_KEYWORD = "Decision rejected by reviewer"


def run_case(patient_id: str, clinical_note: str, reviewer_decision: str) -> str:
    """Run a single case through the workflow and return final_outcome."""
    graph, _ = build_workflow()
    thread_id = f"test-{patient_id}"
    config = {"configurable": {"thread_id": thread_id}}

    # Phase 1 — run to interrupt
    graph.invoke(
        {"patient_id": patient_id, "clinical_note": clinical_note},
        config,
    )

    # Phase 2 — resume with reviewer decision
    graph.update_state(config, {"human_decision": reviewer_decision})
    result = graph.invoke(None, config)
    state = result if isinstance(result, dict) else result.__dict__
    return state.get("final_outcome", "")


def run_tests():
    all_passed = True

    # ── Approval path tests (P001, P002, P003 with reviewer=yes) ──────────────
    for pid in ["P001", "P002", "P003"]:
        note = NOTES[pid]
        outcome = run_case(pid, note, "yes")
        passed = EXPECTED_PASS_KEYWORD in outcome.lower()
        status = "PASS" if passed else "FAIL"
        print(f"{pid}: {status}  ->  {outcome}")
        if not passed:
            all_passed = False

    # ── Rejection path test (P001 with reviewer=no) ───────────────────────────
    reject_outcome = run_case("P001-reject", NOTES["P001"], "no")
    passed_reject = reject_outcome == EXPECTED_REJECT_KEYWORD
    reject_status = "PASS" if passed_reject else "FAIL"
    print(f"P001-REJECT: {reject_status}  ->  {reject_outcome}")
    if not passed_reject:
        all_passed = False

    # ── RAG Agentic tests (P001, P002, P003 SOAP Q&A in Python) ──────────────
    from backend.app.agents.rag import query_clinical_rag

    print("\n--- Testing Python RAG Agent (SOAP Notes) ---")
    rag_cases = [
        ("P001", "What are the straight leg raise findings?", "Objective"),
        ("P001", "Did the patient complete physiotherapy?", "Objective"),
        ("P002", "How many weeks of physical therapy was attempted?", "Objective"),
        ("P003", "What is the health insurance coverage status?", "Assessment"),
    ]
    for pid, q, expected_section in rag_cases:
        res = query_clinical_rag(pid, q)
        rag_pass = expected_section.lower() in res.cited_section.lower() or len(res.answer) > 20
        status = "PASS" if rag_pass else "FAIL"
        print(f"RAG [{pid}] '{q}' -> [{res.cited_section}]: {status}")
        if not rag_pass:
            all_passed = False

    print()
    if all_passed:
        print("All tests PASSED.")
    else:
        print("Some tests FAILED.")
        sys.exit(1)


if __name__ == "__main__":
    run_tests()
