"""
Guardrail module for Python Clinical RAG Agent.
Enforces:
1. Strict 3-Patient Scope Lock (P001 Alex Morgan, P002 Jordan Lee, P003 Casey Kim).
2. Prompt Injection and Jailbreak Defense (OWASP LLM01 / NIST AI RMF).
3. Domain Boundary Enforcement (Lumbar Spine MRI Prior Authorization & SOAP notes).
"""
import re
from typing import Tuple, Optional

AUTHORIZED_PATIENT_IDS = {"P001", "P002", "P003"}

JAILBREAK_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions", re.IGNORECASE),
    re.compile(r"ignore\s+system\s+(prompt|instructions|rules)", re.IGNORECASE),
    re.compile(r"disregard\s+(all\s+)?(rules|guidelines|instructions)", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\s+(in\s+)?(developer\s+mode|unrestricted|dan|jailbreak)", re.IGNORECASE),
    re.compile(r"pretend\s+(you\s+are|to\s+be)\s+(an\s+unrestricted|a\s+hacker|someone\s+without)", re.IGNORECASE),
    re.compile(r"reveal\s+(your\s+)?(system\s+prompt|hidden\s+instructions|developer\s+prompt)", re.IGNORECASE),
    re.compile(r"output\s+the\s+text\s+above", re.IGNORECASE),
    re.compile(r"bypass\s+(the\s+)?(filter|guardrail|security|safety)", re.IGNORECASE),
    re.compile(r"<script[\s>]", re.IGNORECASE),
    re.compile(r"javascript:", re.IGNORECASE),
]

UNAUTHORIZED_PATIENT_PROBES = [
    re.compile(r"\b(patient\s*[4-9]|p0*0?[4-9]|p[1-9]\d{2,})\b", re.IGNORECASE),
    re.compile(r"\b(john\s+doe|jane\s+doe|bob\s+smith|alice\s+wonderland)\b", re.IGNORECASE),
    re.compile(r"\b(hospital\s+ceo|board\s+member|celebrity|vip\s+patient)\b", re.IGNORECASE),
]

CLINICAL_DOMAIN_KEYWORDS = [
    "patient", "pain", "mri", "spine", "lumbar", "soap", "subjective", "objective",
    "assessment", "plan", "physio", "physical therapy", "therapy", "slr", "straight leg",
    "neuro", "exam", "reflex", "dermatome", "weakness", "vas", "duration", "weeks",
    "icd", "cpt", "72148", "insurance", "payer", "active", "denial", "approval",
    "recommendation", "medication", "meloxicam", "gabapentin", "naproxen", "ibuprofen",
    "radiculopathy", "sciatica", "disc", "herniation", "prior auth", "authorization",
    "order", "dos", "provider", "clinic", "memory", "recall", "history", "record", "note"
]


def validate_rag_query(
    patient_id: str,
    question: str
) -> Tuple[bool, Optional[str], Optional[str], Optional[str]]:
    """
    Validate query against security, scope, and domain guardrails.
    Returns: (is_allowed, reason, violation_type, policy_citation)
    """
    q = (question or "").strip()

    # 1. Jailbreak & Prompt Injection Defense
    for pattern in JAILBREAK_PATTERNS:
        if pattern.search(q):
            return (
                False,
                "Security Guardrail Violation: Adversarial prompt or prompt injection attempt detected.",
                "INJECTION",
                "NIST AI RMF §2.2 / OWASP LLM01: Prompt Injection Defense",
            )

    # 2. Unauthorized Patient Probes
    for probe in UNAUTHORIZED_PATIENT_PROBES:
        if probe.search(q):
            return (
                False,
                "Scope Guardrail Violation: Inquiries are strictly restricted to authorized synthetic records P001, P002, and P003.",
                "SCOPE",
                "HIPAA Technical Safeguard § 164.312(a)(1) Access Control",
            )

    # 3. Patient Tenancy Check
    pid = (patient_id or "").strip().upper()
    if pid not in AUTHORIZED_PATIENT_IDS:
        return (
            False,
            f"Scope Guardrail Violation: Patient ID '{patient_id}' is outside the authorized clinical database (P001, P002, P003).",
            "SCOPE",
            "HIPAA Privacy Rule § 164.502 / GDPR Article 5(1)(c) Data Minimization",
        )

    # 4. Domain Boundary Check
    lower_q = q.lower()
    is_domain_relevant = any(kw in lower_q for kw in CLINICAL_DOMAIN_KEYWORDS)
    words = [w for w in q.split() if w]
    if len(words) >= 4 and not is_domain_relevant:
        return (
            False,
            "Domain Guardrail Interception: The inquiry appears unrelated to Lumbar Spine MRI Prior Authorization, clinical SOAP notes, or clinical criteria.",
            "DOMAIN",
            "FDA Good Machine Learning Practice (GMLP) & Clinical Scoping",
        )

    return True, None, None, None
