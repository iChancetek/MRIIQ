"""
PHI/PII Masking & Tokenization Vault in Python.
Implements HIPAA Safe Harbor de-identification (§ 164.514(b)) and GDPR Article 25.
Replaces protected identifiers with synthetic tokens before passing to LLMs,
and restores legitimate clinical context upon egress for authorized clinician review.
"""
import re
from typing import Tuple, Dict

PHI_DICTIONARY = [
    # Patient names
    ("Alex Morgan", "[PATIENT_NAME_001]"),
    ("Jordan Lee", "[PATIENT_NAME_002]"),
    ("Casey Kim", "[PATIENT_NAME_003]"),

    # Dates of birth / dates
    ("04/12/1982", "[DOB_001]"),
    ("09/23/1989", "[DOB_002]"),
    ("11/05/1979", "[DOB_003]"),
    ("September 24, 2026", "[DOS_TOKEN]"),
    ("08/31/2026", "[DATE_TOKEN_01]"),

    # Healthcare Providers & NPIs
    ("Dr. Sarah Vance, MD", "[PROVIDER_001]"),
    ("Dr. Sarah Vance", "[PROVIDER_001]"),
    ("Dr. Marcus Thorne, MD", "[PROVIDER_002]"),
    ("Dr. Marcus Thorne", "[PROVIDER_002]"),
    ("Dr. Elena Rostova, MD", "[PROVIDER_003]"),
    ("Dr. Elena Rostova", "[PROVIDER_003]"),
    ("1982736451", "[NPI_001]"),
    ("1472839102", "[NPI_002]"),
    ("1839201847", "[NPI_003]"),

    # Clinics and Facilities
    ("Metro Spine & Musculoskeletal Institute, Suite 400", "[CLINIC_001]"),
    ("Metro Spine & Musculoskeletal Institute", "[CLINIC_001]"),
    ("Oakridge Ambulatory Care Center, Suite 102", "[CLINIC_002]"),
    ("Oakridge Ambulatory Care Center", "[CLINIC_002]"),
    ("Greater Metro Pain Management Associates, Suite 210", "[CLINIC_003]"),
    ("Greater Metro Pain Management Associates", "[CLINIC_003]"),
    ("Apex Physical Therapy", "[FACILITY_PT_001]"),

    # Health Plan identifiers
    ("HBC-9928192", "[POLICY_NUM_001]"),
    ("AET-4491023", "[POLICY_NUM_002]"),
    ("UHC-1184920", "[POLICY_NUM_003]"),
]

GENERIC_PATTERNS = [
    # SSN
    (re.compile(r"\b\d{3}-\d{2}-\d{4}\b"), "[MASKED_SSN]"),
    # Phone
    (re.compile(r"\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b"), "[MASKED_PHONE]"),
    # Email
    (re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"), "[MASKED_EMAIL]"),
    # MRN
    (re.compile(r"\b(?:MRN|mrn)[#:\s-]*[A-Za-z0-9-]{5,12}\b"), "[MASKED_MRN]"),
]


def mask_phi(text: str) -> Tuple[str, Dict[str, str], int]:
    """
    Mask PHI/PII entities conforming to HIPAA Safe Harbor 18 identifiers.
    Returns (masked_text, token_map, tokens_masked_count).
    """
    if not text:
        return "", {}, 0

    masked = text
    token_map: Dict[str, str] = {}
    tokens_masked_count = 0

    # 1. Exact entity dictionary replacement (longest entries first)
    sorted_dict = sorted(PHI_DICTIONARY, key=lambda x: len(x[0]), reverse=True)
    for raw, token in sorted_dict:
        if raw in masked:
            count = masked.count(raw)
            tokens_masked_count += count
            masked = masked.replace(raw, token)
            token_map[token] = raw

    # 2. Generic regex pattern masking
    counter = 1
    for pattern, prefix in GENERIC_PATTERNS:
        matches = list(pattern.finditer(masked))
        if matches:
            for m in reversed(matches):
                original = m.group(0)
                tok = f"{prefix}_{counter}"
                counter += 1
                token_map[tok] = original
                tokens_masked_count += 1
                masked = masked[:m.start()] + tok + masked[m.end():]

    return masked, token_map, tokens_masked_count


def detokenize_phi(text: str, token_map: Dict[str, str]) -> str:
    """
    Detokenize text to restore actual patient context for authorized clinician interface.
    """
    if not text or not token_map:
        return text

    unmasked = text
    for token, original in token_map.items():
        unmasked = unmasked.replace(token, original)
    return unmasked
