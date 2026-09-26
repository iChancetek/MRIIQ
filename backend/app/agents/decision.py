"""
Deterministic Decision Agent — applies the rule engine to extracted facts.
Never calls an LLM for the authorization decision.
"""
from typing import Optional


def make_decision(
    plan_active: bool,
    pain_weeks: Optional[float],
    physio_weeks: Optional[float],
    min_pain_weeks: int,
    min_physio_weeks: int,
) -> tuple[str, list[str]]:
    """
    Returns (recommendation, denial_reasons).
    recommendation: "APPROVE" or "DENY"
    denial_reasons: list of human-readable reasons for denial (empty if APPROVE).
    """
    denial_reasons: list[str] = []

    if not plan_active:
        denial_reasons.append("Insurance plan is not active.")

    if pain_weeks is None:
        denial_reasons.append(
            "Pain duration not explicitly documented in clinical note."
        )
    elif pain_weeks < min_pain_weeks:
        denial_reasons.append(
            f"Documented pain duration ({pain_weeks}w) is below the required "
            f"{min_pain_weeks}-week minimum."
        )

    if physio_weeks is None:
        denial_reasons.append(
            "Physiotherapy duration not explicitly documented or physiotherapy was not attempted."
        )
    elif physio_weeks == 0:
        denial_reasons.append(
            "No physiotherapy was attempted (explicitly stated in clinical note)."
        )
    elif physio_weeks < min_physio_weeks:
        denial_reasons.append(
            f"Documented physiotherapy duration ({physio_weeks}w) is below the required "
            f"{min_physio_weeks}-week minimum."
        )

    if denial_reasons:
        return "DENY", denial_reasons
    return "APPROVE", []
