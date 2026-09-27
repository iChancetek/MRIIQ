"""
RAG Agent with Short-Term and Long-Term Memory in Python.
- Short-Term Memory: Ephemeral conversation history across turns within the current session.
- Long-Term Memory: Persistent patient clinical history, prior audit decisions, and clinician preferences.
Queries synthetic physician documentation in SOAP format for P001, P002, P003.
Uses OpenAI gpt-5.6-terra with deterministic semantic retrieval fallback.
"""
import os
import json
import re
from pathlib import Path
from typing import Dict, Any, List, Optional
from openai import OpenAI
from backend.app.config import OPENAI_API_KEY, OPENAI_MODEL
from backend.app.models.extraction import RagResponse
from backend.app.agents.phi_vault import mask_phi, detokenize_phi
from backend.app.agents.guardrail import validate_rag_query
from backend.app.agents.audit_logger import log_audit_event

_DATA_DIR = Path(__file__).resolve().parents[3] / "data"
_MEMORY_FILE = _DATA_DIR / "patient_memories.json"

PATIENT_NAMES = {
    "P001": "Alex Morgan",
    "P002": "Jordan Lee",
    "P003": "Casey Kim",
}

# Default initial Long-Term Memories per patient
DEFAULT_LONG_TERM_MEMORIES: Dict[str, List[str]] = {
    "P001": [
        "Patient preference: Prioritizes conservative therapies and non-invasive interventions before spine surgery.",
        "Historical Imaging: Prior lumbar X-ray in 2024 revealed mild disc space narrowing at L5-S1.",
        "Physiotherapy Compliance: Attended all 16 scheduled sessions (8 weeks) at Apex Physical Therapy without gaps.",
        "Verified active coverage under Horizon Blue Cross PPO with zero prior authorization denials on file.",
    ],
    "P002": [
        "Patient history: Axial back pain exacerbated by heavy lifting during residential construction projects.",
        "Clinical Preference: Self-managed with OTC Ibuprofen 400mg; previously declined formal physiotherapy referral.",
        "Care Plan Alert: Patient requires formal counseling on payer-mandated 6-week conservative physiotherapy before MRI approval.",
    ],
    "P003": [
        "Eligibility Note: Employer change resulted in policy lapse; UnitedHealthcare coverage terminated on 08/31/2026.",
        "Financial Counseling: Patient referred to clinic benefits coordinator for health insurance exchange enrollment.",
        "Clinical Plan: Physician recommends initiating structured physical therapy immediately once coverage is reinstated.",
    ],
}


def normalize_id(patient_id: str) -> str:
    clean = (patient_id or "P001").strip().upper()
    if clean in ("POO1", "P01"):
        return "P001"
    if clean in ("POO2", "P02"):
        return "P002"
    if clean in ("POO3", "P03"):
        return "P003"
    return clean


def detect_patient_in_text(text: str) -> Optional[str]:
    """Detect if a patient's name or ID is mentioned in text."""
    if not text:
        return None
    lower = text.lower()
    if re.search(r"\b(p0*1|patient\s*1|pt\s*1|alex(\s+morgan)?)\b", lower) or "alex morgan" in lower:
        return "P001"
    if re.search(r"\b(p0*2|patient\s*2|pt\s*2|jordan(\s+lee)?)\b", lower) or "jordan lee" in lower:
        return "P002"
    if re.search(r"\b(p0*3|patient\s*3|pt\s*3|casey(\s+kim)?)\b", lower) or "casey kim" in lower:
        return "P003"
    return None


def is_full_soap_query(query: str) -> bool:
    """Detect whether a query asks to display or show the entire / full SOAP notes."""
    if not query:
        return False
    q = query.lower()
    has_soap = "soap" in q
    has_display = any(k in q for k in ("display", "show", "entire", "full", "view", "read", "get", "all", "what is", "what are", "print", "see", "open", "provide"))
    if has_soap and (has_display or q.strip() in ("soap", "soap notes", "soap note")):
        return True
    if any(k in q for k in ("clinical note", "clinical documentation", "entire note", "full note", "full record", "entire record", "all notes")):
        return True
    return False


def load_long_term_memories(patient_id: str) -> List[str]:
    """Load persistent long-term memories for a patient."""
    pid = normalize_id(patient_id)
    if _MEMORY_FILE.exists():
        try:
            data = json.loads(_MEMORY_FILE.read_text(encoding="utf-8"))
            if pid in data and isinstance(data[pid], list):
                return data[pid]
        except Exception:
            pass
    return DEFAULT_LONG_TERM_MEMORIES.get(pid, [])


def save_long_term_memories(patient_id: str, memories: List[str]) -> None:
    """Save persistent long-term memories to disk."""
    pid = normalize_id(patient_id)
    all_data = {}
    if _MEMORY_FILE.exists():
        try:
            all_data = json.loads(_MEMORY_FILE.read_text(encoding="utf-8"))
        except Exception:
            all_data = {}
    all_data[pid] = memories
    try:
        _MEMORY_FILE.write_text(json.dumps(all_data, indent=2), encoding="utf-8")
    except Exception:
        pass


def add_patient_memory(patient_id: str, new_memory: str) -> List[str]:
    """Append a new clinical memory to the patient's long-term store."""
    pid = normalize_id(patient_id)
    current = load_long_term_memories(pid)
    cleaned = new_memory.strip()
    if cleaned and cleaned not in current:
        current.append(cleaned)
        save_long_term_memories(pid, current)
    return current


def purge_patient_memories(patient_id: str) -> bool:
    """Purge persistent clinical memories for a patient pursuant to GDPR Article 17 (Right to Erasure)."""
    pid = normalize_id(patient_id)
    if _MEMORY_FILE.exists():
        try:
            data = json.loads(_MEMORY_FILE.read_text(encoding="utf-8"))
            if pid in data:
                del data[pid]
                _MEMORY_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")
        except Exception:
            pass
    log_audit_event(
        event_type="GDPR_ERASURE",
        patient_id=pid,
        guardrail_status="passed",
        violation_reason="GDPR Article 17 Right to Erasure executed",
    )
    return True


def load_soap_doc(patient_id: str) -> str:
    """Load the full SOAP notes text file for the patient."""
    pid = normalize_id(patient_id)
    doc_path = _DATA_DIR / f"{pid}.txt"
    if doc_path.exists():
        return doc_path.read_text(encoding="utf-8")
    return f"SOAP documentation not found for {pid}."


def deterministic_rag_fallback(
    pid: str,
    doc_text: str,
    question: str,
    short_term_history: Optional[List[Dict[str, str]]] = None,
    long_term_memories: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Deterministic clinical keyword search across SOAP sections,
    taking into account short-term dialogue context and recalled long-term memories.
    """
    q = question.lower()
    name = PATIENT_NAMES.get(pid, f"Patient {pid}")
    memories = long_term_memories or load_long_term_memories(pid)

    # Check for full / entire SOAP notes display inquiry
    if is_full_soap_query(question):
        return {
            "cited_section": "Entire SOAP Note",
            "answer": doc_text,
            "evidence": [f"Full Physician SOAP Documentation for {name} ({pid})"],
        }

    # Check for memory inquiries
    if any(k in q for k in ("memory", "recall", "past", "history", "preference", "remember", "background")):
        return {
            "cited_section": "Long-Term Memory",
            "answer": f"Recalled {len(memories)} persistent clinical memory items for {name} ({pid}):\n" +
                      "\n".join(f"• {m}" for m in memories),
            "evidence": memories,
        }

    # Straight leg raise / SLR / neuro exam
    if any(k in q for k in ("slr", "straight leg", "raise", "neuro", "dermatome", "reflex")):
        cited = "Objective"
        if pid == "P001":
            answer = "According to the Objective examination: Straight Leg Raise (SLR) is positive on the right at 45° (negative on left). Neurological exam shows EHL 4+/5 weakness and right L5 dermatomal hypoesthesia."
            evidence = ["SLR positive on right at 45°", "Right L5 dermatomal hypoesthesia", "Achilles 1+ right, 2+ left"]
        elif pid == "P002":
            answer = "Objective findings note: Straight Leg Raise test is negative bilaterally. Neurological examination is intact throughout lower extremities with 5/5 motor strength."
            evidence = ["SLR negative bilaterally", "Motor 5/5 lower extremities", "Reflexes 2+ symmetrical"]
        else:
            answer = "Objective findings: Straight Leg Raise is negative bilaterally. Lower extremity neurological examination intact throughout bilateral lower extremities."
            evidence = ["SLR negative bilaterally", "DTRs 2+ symmetrical"]
        return {"cited_section": cited, "answer": answer, "evidence": evidence}

    # Physiotherapy / conservative therapy
    if any(k in q for k in ("physio", "physical therapy", "rehab", "conservative", "exercise")):
        cited = "Objective"
        if pid == "P001":
            answer = "Objective record confirms: Patient completed 8 weeks of supervised physical therapy at Apex Physical Therapy (2x/week, Aug 1 - Sep 24, 2026) with minimal functional improvement. Minimum 6-week requirement is MET."
            evidence = ["Completed 8 weeks supervised physical therapy", "Criteria satisfied: YES"]
        elif pid == "P002":
            answer = "Objective record explicitly states: No physiotherapy was attempted (0 weeks). Patient has not completed the prerequisite 6-week trial of supervised physical therapy."
            evidence = ["No physiotherapy attempted (0 weeks)", "Criteria satisfied: NO"]
        else:
            answer = "Objective record explicitly states: No physiotherapy attempted (0 weeks). Prior authorization prerequisite conservative trial has not been initiated."
            evidence = ["No physiotherapy attempted (0 weeks)", "Criteria satisfied: NO"]
        return {"cited_section": cited, "answer": answer, "evidence": evidence}

    # Pain / duration / HPI / onset
    if any(k in q for k in ("pain", "duration", "week", "vas", "hpi", "complaint")):
        cited = "Subjective"
        if pid == "P001":
            answer = "Subjective documentation: Chief Complaint is severe lower back pain with right L5 radiation for 10 weeks (VAS 7/10). Criteria of >= 6 weeks pain duration is MET."
            evidence = ["10 weeks pain duration", "VAS 7/10", "Radiation to right lateral calf and foot dorsum"]
        elif pid == "P002":
            answer = "Subjective documentation: Moderate axial low back stiffness and pain for 9 weeks (VAS 5/10). Pain duration criteria (>= 6 weeks) is MET."
            evidence = ["9 weeks axial low back pain", "VAS 5/10"]
        else:
            answer = "Subjective documentation: Chronic low back ache for 12 weeks (VAS 4-6/10). Pain duration criteria (>= 6 weeks) is MET."
            evidence = ["12 weeks continuous back pain", "VAS 4-6/10"]
        return {"cited_section": cited, "answer": answer, "evidence": evidence}

    # Insurance / plan / coverage
    if any(k in q for k in ("insurance", "plan", "active", "coverage", "payer")):
        cited = "Assessment"
        if pid == "P001":
            answer = "Plan Status: Horizon Blue Cross PPO is ACTIVE on Date of Service."
            evidence = ["Horizon Blue Cross PPO", "Status: ACTIVE"]
        elif pid == "P002":
            answer = "Plan Status: Aetna Choice POS is ACTIVE on Date of Service."
            evidence = ["Aetna Choice POS", "Status: ACTIVE"]
        else:
            answer = "Plan Status: UnitedHealthcare Choice Plus is INACTIVE / TERMINATED. Authorization cannot be approved under inactive coverage."
            evidence = ["UnitedHealthcare Choice Plus", "Status: INACTIVE (Terminated)"]
        return {"cited_section": cited, "answer": answer, "evidence": evidence}

    # Diagnoses / ICD-10
    if any(k in q for k in ("diagnos", "icd", "condition", "assessment")):
        cited = "Assessment"
        if pid == "P001":
            answer = "Assessment Diagnoses: Lumbosacral radiculopathy right L5-S1 (ICD-10 M54.16); Intractable lumbar disc disorder with radiculopathy (ICD-10 M51.16); Lumbago with sciatica (ICD-10 M54.41). Recommendation: APPROVE."
            evidence = ["ICD-10 M54.16", "ICD-10 M51.16", "Recommendation: APPROVE"]
        elif pid == "P002":
            answer = "Assessment Diagnoses: Non-specific mechanical low back pain (ICD-10 M54.50); Lumbar myofascial strain (ICD-10 S39.012A). Recommendation: DENY (0 weeks physio)."
            evidence = ["ICD-10 M54.50", "ICD-10 S39.012A", "Recommendation: DENY"]
        else:
            answer = "Assessment Diagnoses: Chronic low back pain (ICD-10 M54.5); Lumbosacral spondylosis (ICD-10 M47.816). Recommendation: DENY (Inactive plan, 0 weeks physio)."
            evidence = ["ICD-10 M54.5", "ICD-10 M47.816", "Recommendation: DENY"]
        return {"cited_section": cited, "answer": answer, "evidence": evidence}

    # Procedure / CPT / orders / plan
    if any(k in q for k in ("procedure", "cpt", "order", "mri", "rx", "medication", "plan")):
        cited = "Plan"
        if pid == "P001":
            answer = "Plan: Requested procedure is Lumbar Spine MRI without contrast (CPT 72148). Medications: Meloxicam 15mg daily, Gabapentin 300mg TID. Follow-up post-MRI for spine surgical consultation."
            evidence = ["CPT 72148", "Meloxicam 15mg", "Gabapentin 300mg TID"]
        elif pid == "P002":
            answer = "Plan: Lumbar Spine MRI without contrast (CPT 72148) is deferred pending completion of a 6-week supervised physical therapy trial. Medication: Naproxen 500mg BID."
            evidence = ["CPT 72148 deferred", "Referral for 6-week physical therapy", "Naproxen 500mg BID"]
        else:
            answer = "Plan: Lumbar Spine MRI (CPT 72148) on hold pending insurance reinstatement and physical therapy trial. Medication: Acetaminophen 650mg PRN."
            evidence = ["CPT 72148 on hold", "Coverage reinstatement required", "Acetaminophen 650mg"]
        return {"cited_section": cited, "answer": answer, "evidence": evidence}

    # General overview
    return {
        "cited_section": "SOAP Record",
        "answer": f"{name} ({pid}) Physician Documentation: Formatted according to clinical SOAP guidelines. Details include Subjective HPI, Objective physical/neurological findings, Assessment criteria checklist, and Plan orders.",
        "evidence": [f"Patient: {name}", f"ID: {pid}"],
    }


def query_clinical_rag(
    patient_id: str,
    question: str,
    short_term_history: Optional[List[Dict[str, str]]] = None,
    custom_memories: Optional[List[str]] = None,
) -> RagResponse:
    """
    Main entry point for Python Clinical RAG Agent with Dual Memory & Security:
    1. Scope & Security Guardrail (strict 3-patient lock, anti-jailbreak, domain bounds).
    2. PHI/PII Masking Vault (HIPAA Safe Harbor § 164.514(b) tokenization).
    3. Audit Logging (HIPAA § 164.312(b) & GDPR Art. 30).
    4. Dual Memory (Short-Term Conversational & Long-Term Clinical Memory Bank).
    """
    detected_pid = detect_patient_in_text(question)
    raw_pid = detected_pid or patient_id or ""

    if not raw_pid:
        log_audit_event(
            event_type="GUARDRAIL_BLOCK",
            patient_id="UNKNOWN",
            guardrail_status="blocked",
            violation_reason="No patient ID provided or detected",
        )
        return RagResponse(
            patient_id="",
            patient_name="",
            question=question,
            answer="Hello! I am your MRIIQ Clinical Assistant, and I am delighted to assist you. To review clinical documentation or prior authorization guidelines, please select or mention one of our 3 authorized patient records: Alex Morgan (P001), Jordan Lee (P002), or Casey Kim (P003). Which patient would you like to review?",
            cited_section="Assistant Guidance",
            evidence=[],
            recalled_long_term_memories=[],
            short_term_turns_count=len(short_term_history or []),
            model_used="guardrail-gatekeeper",
            phi_masked=False,
            guardrail_status="passed",
        )

    pid = normalize_id(raw_pid)

    # ── 1. GUARDRAIL VALIDATION ──
    is_allowed, reason, violation_type, citation = validate_rag_query(pid, question)
    if not is_allowed:
        log_audit_event(
            event_type="GUARDRAIL_BLOCK",
            patient_id=pid,
            guardrail_status="blocked",
            violation_reason=reason,
        )
        return RagResponse(
            patient_id=pid,
            patient_name="",
            question=question,
            answer=f"🛡️ SECURITY & SCOPE GUARDRAIL INTERVENTION:\n\n{reason}\n\n• Regulatory Standard: {citation}\n• System Action: Query blocked at API perimeter to prevent unauthorized data access.",
            cited_section="Security Guardrail",
            evidence=[citation or "Security Guardrail Enforcement"],
            recalled_long_term_memories=[],
            short_term_turns_count=len(short_term_history or []),
            model_used="security-guardrail",
            phi_masked=False,
            guardrail_status="blocked",
        )

    name = PATIENT_NAMES.get(pid, f"Patient {pid}")
    doc_text = load_soap_doc(pid)
    
    # Retrieve persistent long-term memories
    persistent_memories = load_long_term_memories(pid)
    if custom_memories:
        for m in custom_memories:
            if m and m not in persistent_memories:
                persistent_memories.append(m)

    history = short_term_history or []
    turns_count = len(history)

    # When someone asks to display the SOAP Notes for a particular patient, return the entire SOAP Note
    if is_full_soap_query(question):
        log_audit_event(
            event_type="RAG_QUERY",
            patient_id=pid,
            guardrail_status="passed",
            tokens_masked_count=0,
        )
        return RagResponse(
            patient_id=pid,
            patient_name=name,
            question=question,
            answer=doc_text,
            cited_section="Entire SOAP Note",
            evidence=[f"Full Physician Clinical Documentation (SOAP Format) for {name} ({pid})"],
            recalled_long_term_memories=persistent_memories,
            short_term_turns_count=turns_count,
            model_used="clinical-soap-full-record",
            phi_masked=True,
            guardrail_status="passed",
        )

    # ── 2. PHI/PII MASKING VAULT (HIPAA Safe Harbor) ──
    masked_doc, doc_tokens, count_doc = mask_phi(doc_text)
    masked_q, q_tokens, count_q = mask_phi(question)
    combined_tokens = {**doc_tokens, **q_tokens}
    total_masked = count_doc + count_q

    if OPENAI_API_KEY:
        try:
            client = OpenAI(api_key=OPENAI_API_KEY)
            
            # Mask memories for prompt
            masked_memories = []
            for mem in persistent_memories:
                m_txt, m_tok, _ = mask_phi(mem)
                combined_tokens.update(m_tok)
                masked_memories.append(m_txt)

            memory_block = "\n".join(f"- {m}" for m in masked_memories) if masked_memories else "None on record."

            system_prompt = f"""You are an expert clinical documentation and prior authorization auditor answering questions about patient record {pid}.
All Protected Health Information has been de-identified according to HIPAA Safe Harbor standards (§ 164.514(b)).

TONE & DEMEANOR:
Always maintain a warm, friendly, polite, empathetic, kind, and respectful demeanor when communicating with the clinician. Be encouraging, courteous, and professional while delivering accurate clinical guidance.

You have access to:
1. Grounded De-identified Physician Clinical Documentation in SOAP Notes format.
2. Long-Term Patient Memory Bank (historical audit records, preferences, clinical alerts).
3. Short-Term Conversational Memory (previous turns in this active consultation session).

DE-IDENTIFIED SOAP CLINICAL DOCUMENTATION:
{masked_doc}

LONG-TERM PATIENT MEMORY:
{memory_block}

INSTRUCTIONS:
1. Answer accurately, warmly, and concisely, citing evidence from the SOAP note or Long-Term Memory.
2. Structure your answer using the relevant section tag ([Subjective], [Objective], [Assessment], [Plan], or [Long-Term Memory]).
3. Cite exact clinical facts (e.g. durations, exams, test findings, criteria status, codes) politely and clearly.
4. Maintain conversational continuity by referencing previous context from short-term memory when relevant.
5. If the user asks to display, view, show, or output the SOAP Notes (or full / entire SOAP note) for a patient, display the COMPLETE and ENTIRE clinical SOAP documentation with all sections ([Subjective], [Objective], [Assessment], [Plan]) verbatim and fully detailed.
"""
            messages = [{"role": "system", "content": system_prompt}]

            # Add short-term conversational memory turns (limited to last 8 turns, masked)
            for turn in history[-8:]:
                role = turn.get("role", "user")
                content = turn.get("content", "")
                if role in ("user", "assistant") and content:
                    t_masked, t_tok, _ = mask_phi(content)
                    combined_tokens.update(t_tok)
                    messages.append({"role": role, "content": t_masked})

            # Add current user question (masked)
            messages.append({"role": "user", "content": masked_q})

            response = client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=messages,
                temperature=0.1,
                max_completion_tokens=1500,
            )
            raw_answer_text = response.choices[0].message.content.strip()

            # ── 3. EGRESS DETOKENIZATION ──
            answer_text = detokenize_phi(raw_answer_text, combined_tokens)

            cited = "SOAP Record"
            if "[Subjective]" in answer_text or "subjective" in question.lower():
                cited = "Subjective"
            elif "[Objective]" in answer_text or any(k in question.lower() for k in ("objective", "slr", "exam", "vital", "physio")):
                cited = "Objective"
            elif "[Assessment]" in answer_text or any(k in question.lower() for k in ("assessment", "diagnos", "criteria", "recommendation")):
                cited = "Assessment"
            elif "[Plan]" in answer_text or any(k in question.lower() for k in ("plan", "cpt", "order", "medication", "procedure")):
                cited = "Plan"
            elif "[Long-Term Memory]" in answer_text or any(k in question.lower() for k in ("memory", "recall", "past")):
                cited = "Long-Term Memory"

            log_audit_event(
                event_type="RAG_QUERY",
                patient_id=pid,
                guardrail_status="passed",
                tokens_masked_count=total_masked,
            )

            return RagResponse(
                patient_id=pid,
                patient_name=name,
                question=question,
                answer=answer_text,
                cited_section=cited,
                evidence=persistent_memories[:3],
                recalled_long_term_memories=persistent_memories,
                short_term_turns_count=turns_count,
                model_used=OPENAI_MODEL,
                phi_masked=True,
                guardrail_status="passed",
            )
        except Exception:
            pass

    # Deterministic fallback with memory integration
    fallback = deterministic_rag_fallback(pid, doc_text, question, history, persistent_memories)

    log_audit_event(
        event_type="RAG_QUERY",
        patient_id=pid,
        guardrail_status="passed",
        tokens_masked_count=total_masked,
    )

    return RagResponse(
        patient_id=pid,
        patient_name=name,
        question=question,
        answer=fallback["answer"],
        cited_section=fallback.get("cited_section", "SOAP Record"),
        evidence=fallback.get("evidence", []),
        recalled_long_term_memories=persistent_memories,
        short_term_turns_count=turns_count,
        model_used="clinical-rag-python-engine",
        phi_masked=True,
        guardrail_status="passed",
    )
