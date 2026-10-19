# services/ai-service/tests/test_api.py
"""Pruebas de los endpoints del ai-service con el modelo real cargado."""
from prometheus_client import REGISTRY

# Mismo trayecto que usa la transacción sintética de Nagios (check_whereigo_eta.py):
# Parque Santander (Bucaramanga) -> Cañaveral (Floridablanca).
TRAYECTO = {
    "origin_lat": 7.1193,
    "origin_lon": -73.1227,
    "destination_lat": 7.0700,
    "destination_lon": -73.1040,
    "departure_time": "2026-10-19T08:00:00",
}


def test_health_reporta_modelo_cargado_y_version(client):
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["model_loaded"] is True
    assert body["models_loaded"] is True  # campo original, se mantiene para el frontend
    assert body["model_version"]


def test_predict_devuelve_eta_y_tarifa_en_rango(client):
    response = client.post("/predict", json=TRAYECTO)
    assert response.status_code == 200
    body = response.json()
    assert 1 <= body["eta_minutes"] <= 180  # mismo rango plausible que revisa Nagios
    assert 2500 <= body["fare_cop"] <= 200000
    assert body["is_peak_hour"] is True  # 08:00 es hora pico
    assert body["distance_km"] > 0
    assert body["model_version"]


def test_predict_acepta_hora_con_sufijo_z(client):
    response = client.post("/predict", json={**TRAYECTO, "departure_time": "2026-10-19T08:00:00Z"})
    assert response.status_code == 200


def test_predict_cuenta_la_prediccion_en_las_metricas(client):
    version = client.get("/health").json()["model_version"]
    labels = {"kind": "eta", "model_version": version}
    before = REGISTRY.get_sample_value("whereigo_predictions_total", labels) or 0
    client.post("/predict", json=TRAYECTO)
    assert REGISTRY.get_sample_value("whereigo_predictions_total", labels) == before + 1


def test_predict_rechaza_coordenadas_invalidas(client):
    assert client.post("/predict", json={**TRAYECTO, "origin_lat": 120}).status_code == 422


def test_predict_sin_modelo_responde_503(client, monkeypatch):
    monkeypatch.setattr("app.main.eta_model", None)
    response = client.post("/predict", json=TRAYECTO)
    assert response.status_code == 503
    assert response.json() == {"detail": "Modelos no cargados"}


def test_feedback_actualiza_el_mae_movil(client):
    response = client.post("/feedback", json={"kind": "fare", "predicted": 9000, "actual": 10000})
    assert response.status_code == 200
    assert response.json()["mae"] > 0
    assert REGISTRY.get_sample_value("whereigo_model_mae_rolling", {"kind": "fare"}) is not None


def test_metrics_exige_token(client, monkeypatch):
    monkeypatch.setenv("METRICS_TOKEN", "token-de-prueba")
    assert client.get("/metrics").status_code == 401
    assert client.get("/metrics", headers={"Authorization": "Bearer otro"}).status_code == 401
    response = client.get("/metrics", headers={"Authorization": "Bearer token-de-prueba"})
    assert response.status_code == 200
    assert "whereigo_predictions_total" in response.text
