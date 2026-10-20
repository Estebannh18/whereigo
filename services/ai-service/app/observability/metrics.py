# services/ai-service/app/observability/metrics.py
"""Métricas de Prometheus del ai-service (fase de Monitorear).

Además de latencia y volumen, se mide la calidad del modelo en producción:
el MAE móvil compara cada predicción con el valor real que reporta el
simulador de tráfico. Si sube por encima del umbral de las pruebas, Prometheus
dispara la alerta WhereigoModeloDegradado (ops/monitoring/alert-rules.yml).
"""
from __future__ import annotations

import hmac
import os
from collections import deque
from threading import Lock

from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest

PREDICTIONS_TOTAL = Counter(
    "whereigo_predictions_total",
    "Predicciones servidas por el ai-service",
    ["kind", "model_version"],  # kind: eta | fare
)
PREDICTION_LATENCY = Histogram(
    "whereigo_prediction_latency_seconds",
    "Tiempo de inferencia del modelo",
    ["kind"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0),
)
MODEL_MAE = Gauge(
    "whereigo_model_mae_rolling",
    "Error absoluto medio de las últimas N predicciones con valor real conocido",
    ["kind"],
)


class RollingMAE:
    """MAE sobre una ventana deslizante de las últimas `window` observaciones.

    Crítico para MLOps: es la señal de que el modelo se degradó (drift) aunque
    el servicio siga respondiendo 200.
    """

    def __init__(self, kind: str, window: int = 200) -> None:
        if window <= 0:
            raise ValueError("window debe ser positivo")
        self.kind = kind
        self._errors: deque[float] = deque(maxlen=window)
        self._lock = Lock()

    def observe(self, predicted: float, actual: float) -> float:
        """Registra un par (predicción, real) y publica el MAE actualizado."""
        with self._lock:
            self._errors.append(abs(predicted - actual))
            mae = sum(self._errors) / len(self._errors)
        MODEL_MAE.labels(kind=self.kind).set(mae)
        return mae


def record_prediction(kind: str, model_version: str, seconds: float) -> None:
    PREDICTIONS_TOTAL.labels(kind=kind, model_version=model_version).inc()
    PREDICTION_LATENCY.labels(kind=kind).observe(seconds)


def metrics_token_is_valid(authorization_header: str | None) -> bool:
    """/metrics es público en Render: solo responde con el token de Prometheus."""
    expected = os.environ.get("METRICS_TOKEN", "")
    if not expected or not authorization_header:
        return False
    provided = authorization_header.removeprefix("Bearer ").strip()
    return hmac.compare_digest(provided, expected)  # comparación en tiempo constante


def render_metrics() -> tuple[bytes, str]:
    """Cuerpo y content-type para el endpoint /metrics."""
    return generate_latest(), CONTENT_TYPE_LATEST
