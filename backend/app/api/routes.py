"""FastAPI route handlers: /health, /predict, /predict/batch, /stats, /logs."""
from __future__ import annotations
import csv, io, logging
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, status
from pydantic import ValidationError
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.api.schemas import (
    BatchPredictionResponse,
    BatchRequest,
    HealthResponse,
    PredictionResponse,
    StatsResponse,
    TrafficFeatures,
)
from app.core.database import get_db
from app.core.models import PredictionLog
from app.ml.model_loader import get_model_bundle
from app.rules.signature_engine import get_signature_engine
from app.services.prediction_service import PredictionService
from app.utils.ip_utils import get_client_ip

router = APIRouter()
logger = logging.getLogger(__name__)

def get_service() -> PredictionService:
    b = get_model_bundle()
    if not b.loaded:
        raise HTTPException(503, "Models not loaded. Run the training pipeline first.")
    return PredictionService(bundle=b, sig_engine=get_signature_engine())

@router.get("/health", response_model=HealthResponse, tags=["system"])
def health():
    b = get_model_bundle()
    return HealthResponse(
        status="ok" if b.loaded else "degraded",
        models_loaded=b.loaded,
        classifier_ready=b.classifier is not None,
        autoencoder_ready=b.autoencoder is not None,
        version=b.version,
    )

@router.post("/predict", response_model=PredictionResponse, tags=["inference"])
def predict(
    request: Request,
    features: TrafficFeatures,
    db: Session = Depends(get_db),
    svc: PredictionService = Depends(get_service),
):
    return svc.predict_one(features, db=db, client_ip=get_client_ip(request))

def _parse_batch_json(body):
    try:
        if isinstance(body, list):
            return BatchRequest(records=body).records
        if isinstance(body, dict) and "records" in body:
            return BatchRequest(**body).records
    except ValidationError as e:
        raise HTTPException(422, detail=e.errors())
    raise HTTPException(400, "JSON payload must be an array or contain a 'records' key")


@router.post("/predict/batch", response_model=BatchPredictionResponse, tags=["inference"])
async def predict_batch(
    request: Request,
    db: Session = Depends(get_db),
    svc: PredictionService = Depends(get_service),
):
    ct = request.headers.get("content-type", "")
    if "multipart/form-data" in ct:
        form = await request.form()
        file = form.get("file")
        if not file:
            raise HTTPException(400, "'file' field missing")
        text = (await file.read()).decode("utf-8", "replace")
        records = _parse_csv(text)
    elif "application/json" in ct:
        try:
            body = await request.json()
        except Exception:
            raise HTTPException(400, "Invalid JSON payload")
        records = _parse_batch_json(body)
    else:
        try:
            body = await request.json()
        except Exception:
            raise HTTPException(415, "Use application/json or multipart CSV upload")
        records = _parse_batch_json(body)

    results = svc.predict_batch(records, db=db, client_ip=get_client_ip(request))
    return BatchPredictionResponse(total=len(results), results=results)

def _parse_csv(text: str):
    STRING_FIELDS = {"url", "body", "header"}
    records = []
    for row in csv.DictReader(io.StringIO(text)):
        d = {}
        for k, v in row.items():
            if not k:
                continue
            k = k.strip()
            if k in STRING_FIELDS:
                d[k] = v.strip() or None
            else:
                try:
                    d[k] = float(v) if v and v.strip() else None
                except Exception:
                    pass
        try:
            records.append(TrafficFeatures(**d))
        except Exception as e:
            logger.warning("Skipping bad CSV row: %s", e)
    if not records:
        raise HTTPException(400, "No valid CSV records")
    return records

@router.get("/stats", response_model=StatsResponse, tags=["system"])
def stats(db: Session = Depends(get_db)):
    total = db.query(func.count(PredictionLog.id)).scalar() or 0
    att_rows = (
        db.query(PredictionLog.predicted_attack, func.count(PredictionLog.id))
        .group_by(PredictionLog.predicted_attack)
        .all()
    )
    sev_rows = (
        db.query(PredictionLog.severity, func.count(PredictionLog.id))
        .group_by(PredictionLog.severity)
        .all()
    )
    anom = (
        db.query(func.count(PredictionLog.id))
        .filter(PredictionLog.anomaly_score > 0.4)
        .scalar()
        or 0
    )
    return StatsResponse(
        total_requests=total,
        attack_distribution={r[0]: r[1] for r in att_rows},
        severity_counts={r[0]: r[1] for r in sev_rows},
        anomaly_rate=round(anom / max(total, 1), 4),
    )

@router.get("/logs", tags=["system"])
def get_logs(limit: int = 100, db: Session = Depends(get_db)):
    logs = (
        db.query(PredictionLog)
        .order_by(PredictionLog.id.desc())
        .limit(limit)
        .all()
    )
    return [log.to_dict() for log in logs]

@router.delete("/stats/reset", tags=["system"])
def reset_stats(db: Session = Depends(get_db)):
    """Delete all prediction logs — resets dashboard to zero."""
    deleted = db.query(PredictionLog).delete()
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Reset failed: {e}")
    return {"deleted": deleted, "message": "All prediction logs cleared"}
