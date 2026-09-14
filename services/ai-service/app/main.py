# services/ai-service/app/main.py
import json
import logging
import os
import threading
import time
from contextlib import asynccontextmanager
from typing import Any

import numpy as np
import pandas as pd
from fastapi import FastAPI
from pydantic import BaseModel, Field

from app.model import FARE_TARGET_SCALE, TinyMLP, r2_score, train_models
from app.rabbitmq.consumer import start_rabbitmq_consumer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Configuración ---
RABBITMQ_ENABLED = os.getenv("RABBITMQ_ENABLED", "true").lower() == "true"
RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", "localhost")
RABBITMQ_PORT = int(os.getenv("RABBITMQ_PORT", "5672"))
RABBITMQ_USER = os.getenv("RABBITMQ_USER", "whereigo")
RABBITMQ_PASSWORD = os.getenv("RABBITMQ_PASSWORD", "changeme")
RABBITMQ_EXCHANGE = os.getenv("RABBITMQ_EXCHANGE", "traffic.events")

# Estado de tráfico en memoria: segment_id -> última lectura.
traffic_state: dict[str, dict[str, Any]] = {}

# --- Modelos ---
eta_model: TinyMLP | None = None
fare_model: TinyMLP | None = None
feature_stats: dict[str, Any] = {"mean": [], "std": []}
model_features = [
    "distance_km",
    "avg_congestion",
    "is_peak_hour",
    "is_rainy",
    "has_incident",
    "hour",
    "day_of_week",
]


# --- Generación de dataset sintético ---
def generate_synthetic_dataset(n_samples: int = 3000) -> pd.DataFrame:
    np.random.seed(42)

    distance_km = np.random.uniform(0.5, 25.0, n_samples)
    avg_congestion = np.random.uniform(0, 100, n_samples)
    is_peak_hour = np.random.choice([0, 1], n_samples, p=[0.7, 0.3])
    is_rainy = np.random.choice([0, 1], n_samples, p=[0.85, 0.15])
    has_incident = np.random.choice([0, 1], n_samples, p=[0.95, 0.05])
    hour = np.random.randint(0, 24, n_samples)
    day_of_week = np.random.randint(0, 7, n_samples)

    eta_minutes = (
        distance_km * 2.0
        + (avg_congestion / 100) * distance_km * 3.0
        + is_peak_hour * distance_km * 1.5
        + is_rainy * distance_km * 1.2
        + has_incident * distance_km * 4.0
        + np.random.normal(0, 2, n_samples)
    )
    eta_minutes = np.maximum(eta_minutes, 1.0)

    fare_cop = (
        distance_km * 3000
        + is_peak_hour * distance_km * 500
        + is_rainy * distance_km * 700
        + has_incident * distance_km * 1500
        + np.random.normal(0, 1000, n_samples)
    )
    fare_cop = np.maximum(fare_cop, 2500.0)

    return pd.DataFrame({
        "distance_km": distance_km,
        "avg_congestion": avg_congestion,
        "is_peak_hour": is_peak_hour,
        "is_rainy": is_rainy,
        "has_incident": has_incident,
        "hour": hour,
        "day_of_week": day_of_week,
        "eta_minutes": eta_minutes,
        "fare_cop": fare_cop,
    })


def save_models() -> None:
    os.makedirs("app/models", exist_ok=True)
    if eta_model:
        eta_model.save("app/models/eta_model.npz")
    if fare_model:
        fare_model.save("app/models/fare_model.npz")
    with open("app/models/feature_stats.json", "w") as f:
        json.dump(feature_stats, f)
    logger.info("Modelos guardados en app/models/")


def load_models() -> bool:
    global eta_model, fare_model, feature_stats
    try:
        eta_model = TinyMLP(input_size=len(model_features), hidden_size=16)
        eta_model.load("app/models/eta_model.npz")
        fare_model = TinyMLP(input_size=len(model_features), hidden_size=16)
        fare_model.load("app/models/fare_model.npz")
        with open("app/models/feature_stats.json", "r") as f:
            feature_stats = json.load(f)
        if "fare_scale" not in feature_stats:
            return False
        logger.info("Modelos cargados desde app/models/")
        return True
    except FileNotFoundError:
        return False


# --- RabbitMQ consumer en segundo plano ---
def rabbitmq_worker() -> None:
    while True:
        try:
            start_rabbitmq_consumer(
                host=RABBITMQ_HOST,
                port=RABBITMQ_PORT,
                user=RABBITMQ_USER,
                password=RABBITMQ_PASSWORD,
                exchange=RABBITMQ_EXCHANGE,
                on_traffic_update=handle_traffic_update,
            )
        except Exception as e:
            logger.error(f"RabbitMQ consumer error: {e}. Reintentando en 5s...")
            time.sleep(5)


def handle_traffic_update(event: dict[str, Any]) -> None:
    segment_id = event.get("segmentId")
    if segment_id:
        traffic_state[segment_id] = event
        logger.debug(f"Estado de tráfico actualizado para {segment_id}")


# --- FastAPI app ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global eta_model, fare_model, feature_stats

    if not load_models():
        df = generate_synthetic_dataset()
        eta_model, fare_model, feature_stats = train_models(df, model_features)
        save_models()

    if RABBITMQ_ENABLED:
        thread = threading.Thread(target=rabbitmq_worker, daemon=True)
        thread.start()
        logger.info("Consumidor RabbitMQ iniciado en segundo plano.")

    yield


app = FastAPI(
    title="Whereigo? AI Service",
    description="Predicción de ETA y tarifas con redes neuronales (TinyMLP)",
    version="1.0.0",
    lifespan=lifespan,
)


# --- Schemas ---
class PredictRequest(BaseModel):
    origin_lat: float = Field(..., ge=-90, le=90, description="Latitud del origen")
    origin_lon: float = Field(..., ge=-180, le=180, description="Longitud del origen")
    destination_lat: float = Field(..., ge=-90, le=90, description="Latitud del destino")
    destination_lon: float = Field(..., ge=-180, le=180, description="Longitud del destino")
    departure_time: str | None = Field(None, description="Hora de salida en formato ISO 8601. Si no se envía, se usa la hora actual.")


class PredictResponse(BaseModel):
    eta_minutes: float
    fare_cop: float
    distance_km: float
    avg_congestion: float
    is_peak_hour: bool
    is_rainy: bool
    has_incident: bool


class HealthResponse(BaseModel):
    status: str
    service: str
    models_loaded: bool
    traffic_segments_known: int


# --- Helpers ---
def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    phi1, phi2 = np.radians(lat1), np.radians(lat2)
    dphi = np.radians(lat2 - lat1)
    dlambda = np.radians(lon2 - lon1)
    a = np.sin(dphi / 2) ** 2 + np.cos(phi1) * np.cos(phi2) * np.sin(dlambda / 2) ** 2
    c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))
    return R * c


def build_features(req: PredictRequest) -> pd.DataFrame:
    from datetime import datetime

    departure = req.departure_time or datetime.now().isoformat()
    dt = datetime.fromisoformat(departure.replace("Z", "+00:00"))

    distance = haversine_distance(
        req.origin_lat, req.origin_lon, req.destination_lat, req.destination_lon
    )

    if traffic_state:
        avg_congestion = sum(s.get("congestionLevel", 0) for s in traffic_state.values()) / len(traffic_state)
        has_incident = any(s.get("hasIncident", False) for s in traffic_state.values())
        is_rainy = any(s.get("isRainy", False) for s in traffic_state.values())
    else:
        avg_congestion = 30.0
        has_incident = False
        is_rainy = False

    is_peak_hour = 1 if (6 <= dt.hour <= 9 or 17 <= dt.hour <= 20) else 0

    return pd.DataFrame([{
        "distance_km": distance,
        "avg_congestion": avg_congestion,
        "is_peak_hour": is_peak_hour,
        "is_rainy": int(is_rainy),
        "has_incident": int(has_incident),
        "hour": dt.hour,
        "day_of_week": dt.weekday(),
    }])


# --- Endpoints ---
@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(
        status="ok",
        service="ai-service",
        models_loaded=eta_model is not None and fare_model is not None,
        traffic_segments_known=len(traffic_state),
    )


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    if eta_model is None or fare_model is None or not feature_stats["mean"]:
        return {"error": "Modelos no cargados"}, 503

    features = build_features(req)
    X = features[model_features].values
    mean = np.array(feature_stats["mean"])
    std = np.array(feature_stats["std"])
    X_norm = (X - mean) / std

    eta = float(eta_model.predict(X_norm)[0, 0])
    fare_scale = float(feature_stats.get("fare_scale", FARE_TARGET_SCALE))
    fare = float(fare_model.predict(X_norm)[0, 0]) * fare_scale

    return PredictResponse(
        eta_minutes=round(float(np.clip(eta, 1.0, 240.0)), 1),
        fare_cop=round(float(np.clip(fare, 2500.0, 200000.0)), 0),
        distance_km=round(float(features["distance_km"].iloc[0]), 2),
        avg_congestion=round(float(features["avg_congestion"].iloc[0]), 1),
        is_peak_hour=bool(features["is_peak_hour"].iloc[0]),
        is_rainy=bool(features["is_rainy"].iloc[0]),
        has_incident=bool(features["has_incident"].iloc[0]),
    )


@app.get("/traffic-state")
def get_traffic_state():
    return {"segments": len(traffic_state), "data": list(traffic_state.values())}
