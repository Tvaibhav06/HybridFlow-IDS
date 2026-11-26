"""Composite threat scoring: combines classifier, anomaly, and signature signals."""
from __future__ import annotations
from app.config import settings

SEVERITY = [(81, "critical"), (61, "high"), (31, "medium"), (0, "low")]
SIG_SEVERITY_FLOORS = {"low": 25.0, "medium": 50.0, "high": 65.0, "critical": 85.0}


def compute_threat_score(
    classifier_confidence: float,
    anomaly_score: float,
    signature_detected: bool,
    predicted_attack: str = "ATTACK",
    signature_severity: str | None = None,
) -> tuple[float, str]:
    """Return (threat_score 0-100, severity label)."""
    is_benign = predicted_attack.upper() == "BENIGN"
    attack_confidence = (1.0 - classifier_confidence) if is_benign else classifier_confidence
    raw = (
        settings.classifier_weight * attack_confidence
        + settings.anomaly_weight * anomaly_score
        + settings.signature_weight * (1.0 if signature_detected else 0.0)
    )
    score = round(max(0.0, min(100.0, raw * 100.0)), 2)
    if signature_detected:
        floor = SIG_SEVERITY_FLOORS.get((signature_severity or "high").lower(), 65.0)
        score = max(score, floor)
    return score, _severity(score)


def _severity(score: float) -> str:
    for thr, lbl in SEVERITY:
        if score >= thr:
            return lbl
    return "low"
