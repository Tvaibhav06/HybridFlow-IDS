"""FastAPI route handlers: /health, /predict."""
from __future__ import annotations
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.api.schemas import HealthResponse, PredictionResponse, TrafficFeatures
from app.core.database import get_db
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
