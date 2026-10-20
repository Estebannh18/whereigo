# services/ai-service/tests/test_logging.py
"""Logs JSON y registro de predicciones (MLOps), sin datos personales."""
import json
import logging

from app.observability.logging import JsonFormatter


def test_json_formatter_incluye_los_campos_extra():
    record = logging.makeLogRecord(
        {"name": "app.main", "levelname": "INFO", "msg": "prediccion", "event": "prediction", "eta_minutes": 17.8}
    )
    entry = json.loads(JsonFormatter().format(record))
    assert entry["msg"] == "prediccion"
    assert entry["service"] == "ai-service"
    assert entry["event"] == "prediction"
    assert entry["eta_minutes"] == 17.8
    assert "ts" in entry and entry["level"] == "INFO"


def test_cada_prediccion_queda_registrada_con_sus_variables_y_sin_coordenadas(client, caplog):
    trayecto = {"origin_lat": 7.1193, "origin_lon": -73.1227, "destination_lat": 7.07, "destination_lon": -73.104}
    with caplog.at_level(logging.INFO, logger="app.main"):
        assert client.post("/predict", json=trayecto).status_code == 200

    records = [r for r in caplog.records if getattr(r, "event", None) == "prediction"]
    assert len(records) == 1
    line = JsonFormatter().format(records[0])
    entry = json.loads(line)
    assert set(entry["features"]) == {
        "distance_km", "avg_congestion", "is_peak_hour", "is_rainy", "has_incident", "hour", "day_of_week",
    }
    assert entry["model_version"] and entry["latency_ms"] >= 0
    assert "7.1193" not in line and "-73.1227" not in line  # nunca la ubicación del usuario


def test_model_path_configurable(tmp_path, monkeypatch, client):
    import app.main as ai_main

    monkeypatch.setattr(ai_main, "MODEL_PATH", str(tmp_path))
    ai_main.save_models()
    assert {p.name for p in tmp_path.iterdir()} == {"eta_model.npz", "fare_model.npz", "feature_stats.json"}
    assert ai_main.load_models() is True
