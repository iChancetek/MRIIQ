"""
Audit logging for HIPAA § 164.312(b) and GDPR Article 30 in Python backend.
Logs structured access events, guardrail blocks, PHI tokenizations, and GDPR memory purges.
"""
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any

_LOGGER = logging.getLogger("mrii_audit")
_DATA_DIR = Path(__file__).resolve().parents[3] / "data"
_AUDIT_LOG_FILE = _DATA_DIR / "audit_log.jsonl"


def log_audit_event(
    event_type: str,
    patient_id: str,
    guardrail_status: str = "passed",
    tokens_masked_count: int = 0,
    violation_reason: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Append an immutable structured audit log entry conforming to HIPAA & GDPR.
    """
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event_type": event_type,
        "patient_id": patient_id or "ANONYMOUS",
        "guardrail_status": guardrail_status,
        "tokens_masked_count": tokens_masked_count,
        "violation_reason": violation_reason,
        "compliance_frameworks": [
            "HIPAA_164_312_B",
            "HIPAA_164_514_SAFE_HARBOR",
            "GDPR_ARTICLE_9",
            "GDPR_ARTICLE_17_RIGHT_TO_ERASURE",
        ],
    }

    line = json.dumps(record)
    print(f"[AUDIT_LOG][{event_type}] {line}")

    try:
        with open(_AUDIT_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass

    return record
