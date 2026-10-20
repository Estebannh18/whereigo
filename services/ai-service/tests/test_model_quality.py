# services/ai-service/tests/test_model_quality.py
"""Prueba de calidad del modelo (MLOps): el modelo debe aportar sobre una línea base.

Se entrena igual que en producción y se mide el MAE en el 20 % de datos que el
modelo no vio. Una línea base ingenua (predecir siempre el promedio) marca el piso:
si el modelo no la supera, el entrenamiento está roto.

MAE_ETA_MAXIMO es el mismo umbral de la alerta WhereigoModeloDegradado
(ops/monitoring/alert-rules.yml). El TinyMLP 1.1 (Adam, mini-lotes y parada
temprana) da ~2 min de MAE en ETA; el ruido del dataset sintético es de 2 min.
"""
import numpy as np

from app.main import generate_synthetic_dataset, model_features
from app.model import FARE_TARGET_SCALE, train_models

MAE_ETA_MAXIMO = 5.0


def _evaluate():
    df = generate_synthetic_dataset()
    eta_model, fare_model, stats = train_models(df, model_features)
    X = (df[model_features].values - np.array(stats["mean"])) / np.array(stats["std"])
    split = int(0.8 * len(df))  # mismo corte que train_models
    X_test = X[split:]
    eta_true = df["eta_minutes"].values
    fare_true = df["fare_cop"].values
    return {
        "eta_mae": float(np.mean(np.abs(eta_model.predict(X_test).flatten() - eta_true[split:]))),
        "eta_base": float(np.mean(np.abs(eta_true[:split].mean() - eta_true[split:]))),
        "fare_mae": float(
            np.mean(np.abs(fare_model.predict(X_test).flatten() * FARE_TARGET_SCALE - fare_true[split:]))
        ),
        "fare_base": float(np.mean(np.abs(fare_true[:split].mean() - fare_true[split:]))),
    }


def test_modelo_supera_la_linea_base_y_el_umbral_de_la_alerta():
    result = _evaluate()
    assert result["eta_mae"] < result["eta_base"], result
    assert result["fare_mae"] < result["fare_base"], result
    assert result["eta_mae"] < MAE_ETA_MAXIMO, result
