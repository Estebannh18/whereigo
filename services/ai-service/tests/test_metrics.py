# services/ai-service/tests/test_metrics.py
"""Pruebas (pytest) de las métricas que alimentan el monitoreo del modelo."""
import pytest
from prometheus_client import REGISTRY

from app.observability.metrics import (
    RollingMAE,
    metrics_token_is_valid,
    record_prediction,
    render_metrics,
)


def test_mae_movil_promedia_los_errores_absolutos():
    mae = RollingMAE(kind="eta-test", window=3)
    mae.observe(predicted=10, actual=12)   # error 2
    assert mae.observe(predicted=20, actual=16) == pytest.approx(3.0)  # (2 + 4) / 2
    assert REGISTRY.get_sample_value("whereigo_model_mae_rolling", {"kind": "eta-test"}) == pytest.approx(3.0)


def test_mae_movil_olvida_lo_que_sale_de_la_ventana():
    mae = RollingMAE(kind="fare-test", window=2)
    mae.observe(100, 200)                  # error 100: saldrá de la ventana
    mae.observe(10, 11)
    assert mae.observe(10, 13) == pytest.approx(2.0)  # (1 + 3) / 2


def test_ventana_invalida():
    with pytest.raises(ValueError):
        RollingMAE(kind="x", window=0)


def test_contador_de_predicciones_por_version():
    labels = {"kind": "eta", "model_version": "xgb-t"}
    before = REGISTRY.get_sample_value("whereigo_predictions_total", labels) or 0
    record_prediction("eta", "xgb-t", 0.02)
    assert REGISTRY.get_sample_value("whereigo_predictions_total", labels) == before + 1


def test_metrics_exige_token(monkeypatch):
    monkeypatch.setenv("METRICS_TOKEN", "token-de-prueba")
    assert metrics_token_is_valid("Bearer token-de-prueba")
    assert not metrics_token_is_valid("Bearer otro")
    assert not metrics_token_is_valid(None)
    monkeypatch.setenv("METRICS_TOKEN", "")
    assert not metrics_token_is_valid("Bearer ")  # sin token configurado, nadie entra


def test_render_metrics_incluye_el_mae():
    body, content_type = render_metrics()
    assert b"whereigo_model_mae_rolling" in body
    assert content_type.startswith("text/plain")
