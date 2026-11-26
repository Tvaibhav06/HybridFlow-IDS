"""End-to-end FastAPI integration tests using TestClient and an isolated SQLite DB."""
from __future__ import annotations
import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.main import app

SAMPLES_DIR = Path(__file__).resolve().parent.parent / "samples"


@pytest.fixture()
def api_client(tmp_path: Path):
    """Provide a TestClient backed by an isolated temporary SQLite database."""
    db_file = tmp_path / "test_e2e.db"
    test_engine = create_engine(
        f"sqlite:///{db_file}", connect_args={"check_same_thread": False}
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    Base.metadata.create_all(bind=test_engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            yield client
    finally:
        app.dependency_overrides.clear()
        test_engine.dispose()


def test_health_endpoint(api_client: TestClient):
    res = api_client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["models_loaded"] is True
    assert body["classifier_ready"] is True
    assert body["autoencoder_ready"] is True


def test_predict_benign_and_ddos_samples(api_client: TestClient):
    benign_payload = json.loads((SAMPLES_DIR / "benign_https.json").read_text())
    r_benign = api_client.post("/predict", json=benign_payload)
    assert r_benign.status_code == 200
    b = r_benign.json()
    assert b["predicted_attack"] == "BENIGN"
    assert b["severity"] == "low"
    assert b["threat_score"] < 31

    ddos_payload = json.loads((SAMPLES_DIR / "ddos_syn_flood.json").read_text())
    r_ddos = api_client.post("/predict", json=ddos_payload)
    assert r_ddos.status_code == 200
    d = r_ddos.json()
    assert d["predicted_attack"] in ("DDOS", "DOS")
    assert d["confidence"] > 0.8
    assert d["severity"] in ("medium", "high", "critical")


def test_predict_signature_override_and_stats_reset(api_client: TestClient):
    sqli_payload = {
        "flow_duration": 120,
        "packet_count": 10,
        "url": "/login?id=1 UNION SELECT * FROM users",
    }
    res = api_client.post("/predict", json=sqli_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["signature_matched"] is True
    assert "SQL-001" in data["signature_rule"]
    assert data["threat_score"] >= 65.0
    assert data["severity"] in ("high", "critical")

    stats = api_client.get("/stats").json()
    assert stats["total_requests"] == 1
    assert data["predicted_attack"] in stats["attack_distribution"]

    logs = api_client.get("/logs?limit=10").json()
    assert len(logs) == 1
    assert "SQL-001" in logs[0]["signature_rule"]

    reset = api_client.delete("/stats/reset")
    assert reset.status_code == 200
    assert reset.json()["deleted"] == 1
    assert api_client.get("/stats").json()["total_requests"] == 0


def test_batch_json_and_csv_upload(api_client: TestClient):
    benign_payload = json.loads((SAMPLES_DIR / "benign_https.json").read_text())
    ddos_payload = json.loads((SAMPLES_DIR / "ddos_syn_flood.json").read_text())

    r_json = api_client.post("/predict/batch", json={"records": [benign_payload, ddos_payload]})
    assert r_json.status_code == 200
    assert r_json.json()["total"] == 2
    assert r_json.json()["results"][0]["predicted_attack"] == "BENIGN"
    assert r_json.json()["results"][1]["predicted_attack"] in ("DDOS", "DOS")

    csv_bytes = (SAMPLES_DIR / "hybridflow_realworld_100.csv").read_bytes()
    r_csv = api_client.post(
        "/predict/batch",
        files={"file": ("hybridflow_realworld_100.csv", csv_bytes, "text/csv")},
    )
    assert r_csv.status_code == 200
    assert r_csv.json()["total"] == 83

    stats = api_client.get("/stats").json()
    assert stats["total_requests"] == 85
    assert 0.0 <= stats["anomaly_rate"] <= 1.0


def test_invalid_inputs_return_4xx(api_client: TestClient):
    r_neg = api_client.post("/predict", json={"flow_duration": -10})
    assert r_neg.status_code == 422

    r_bad_batch = api_client.post("/predict/batch", json={"bad_key": []})
    assert r_bad_batch.status_code == 400
