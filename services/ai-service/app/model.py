# services/ai-service/app/model.py
import logging
import os
from typing import Any

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

FARE_TARGET_SCALE = 10000.0


class TinyMLP:
    """Perceptrón multicapa de 2 capas ocultas implementado en NumPy."""

    PARAM_NAMES = ("W1", "b1", "W2", "b2", "W3", "b3")

    def __init__(self, input_size: int, hidden_size: int = 16, output_size: int = 1):
        rng = np.random.default_rng(42)
        # Inicialización He: mantiene la varianza de las activaciones con ReLU.
        self.W1 = rng.normal(0, np.sqrt(2.0 / input_size), (input_size, hidden_size))
        self.b1 = np.zeros((1, hidden_size))
        self.W2 = rng.normal(0, np.sqrt(2.0 / hidden_size), (hidden_size, hidden_size // 2))
        self.b2 = np.zeros((1, hidden_size // 2))
        self.W3 = rng.normal(0, np.sqrt(2.0 / (hidden_size // 2)), (hidden_size // 2, output_size))
        self.b3 = np.zeros((1, output_size))

    @staticmethod
    def relu(z: np.ndarray) -> np.ndarray:
        return np.maximum(0, z)

    def forward(self, X: np.ndarray) -> np.ndarray:
        self.z1 = X @ self.W1 + self.b1
        self.a1 = self.relu(self.z1)
        self.z2 = self.a1 @ self.W2 + self.b2
        self.a2 = self.relu(self.z2)
        self.z3 = self.a2 @ self.W3 + self.b3
        return self.z3

    def predict(self, X: np.ndarray) -> np.ndarray:
        return self.forward(X)

    def _gradients(self, X: np.ndarray, y: np.ndarray) -> dict[str, np.ndarray]:
        """Gradientes del error cuadrático medio (la mitad) respecto a cada parámetro."""
        z3 = self.forward(X)
        dz3 = (z3 - y) / X.shape[0]
        da2 = dz3 @ self.W3.T
        dz2 = da2 * (self.z2 > 0)
        da1 = dz2 @ self.W2.T
        dz1 = da1 * (self.z1 > 0)
        return {
            "W3": self.a2.T @ dz3,
            "b3": np.sum(dz3, axis=0, keepdims=True),
            "W2": self.a1.T @ dz2,
            "b2": np.sum(dz2, axis=0, keepdims=True),
            "W1": X.T @ dz1,
            "b1": np.sum(dz1, axis=0, keepdims=True),
        }

    def fit(
        self,
        X: np.ndarray,
        y: np.ndarray,
        epochs: int = 300,
        lr: float = 0.005,
        batch_size: int = 64,
        patience: int = 30,
        val_fraction: float = 0.1,
    ) -> None:
        """Entrena con mini-lotes y Adam, con parada temprana sobre una validación interna.

        El objetivo se estandariza durante el entrenamiento y la escala se devuelve a la
        última capa al final, así predict() sigue en las mismas unidades que y.
        """
        y = y.reshape(-1, 1) if y.ndim == 1 else y
        n_val = int(len(X) * val_fraction)
        X_fit, y_fit = X[: len(X) - n_val], y[: len(y) - n_val]
        X_val, y_val = X[len(X) - n_val :], y[len(y) - n_val :]

        y_mean = y_fit.mean(axis=0, keepdims=True)
        y_std = y_fit.std(axis=0, keepdims=True) + 1e-8
        y_fit = (y_fit - y_mean) / y_std
        y_val = (y_val - y_mean) / y_std

        rng = np.random.default_rng(42)
        beta1, beta2, eps = 0.9, 0.999, 1e-8
        m = {name: np.zeros_like(getattr(self, name)) for name in self.PARAM_NAMES}
        v = {name: np.zeros_like(getattr(self, name)) for name in self.PARAM_NAMES}
        step = 0
        best_loss = np.inf
        best_params = self._copy_params()
        epochs_without_improvement = 0

        for epoch in range(epochs):
            order = rng.permutation(len(X_fit))
            for i in range(0, len(order), batch_size):
                batch = order[i : i + batch_size]
                grads = self._gradients(X_fit[batch], y_fit[batch])
                step += 1
                for name in self.PARAM_NAMES:
                    m[name] = beta1 * m[name] + (1 - beta1) * grads[name]
                    v[name] = beta2 * v[name] + (1 - beta2) * grads[name] ** 2
                    m_hat = m[name] / (1 - beta1**step)
                    v_hat = v[name] / (1 - beta2**step)
                    setattr(self, name, getattr(self, name) - lr * m_hat / (np.sqrt(v_hat) + eps))

            val_data = (X_val, y_val) if n_val else (X_fit, y_fit)
            val_loss = float(np.mean((self.forward(val_data[0]) - val_data[1]) ** 2))
            if val_loss < best_loss - 1e-6:
                best_loss = val_loss
                best_params = self._copy_params()
                epochs_without_improvement = 0
            else:
                epochs_without_improvement += 1
            if epoch % 50 == 0:
                logger.debug("Epoch %d, val loss: %.4f", epoch, val_loss)
            if epochs_without_improvement >= patience:
                logger.debug("Parada temprana en la época %d", epoch)
                break

        for name, value in best_params.items():
            setattr(self, name, value)
        # Deshace la estandarización del objetivo dentro de la última capa.
        self.W3 = self.W3 * y_std
        self.b3 = self.b3 * y_std + y_mean

    def _copy_params(self) -> dict[str, np.ndarray]:
        return {name: getattr(self, name).copy() for name in self.PARAM_NAMES}

    def save(self, path: str) -> None:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        np.savez(path, W1=self.W1, b1=self.b1, W2=self.W2, b2=self.b2, W3=self.W3, b3=self.b3)

    def load(self, path: str) -> None:
        data = np.load(path)
        self.W1 = data["W1"]
        self.b1 = data["b1"]
        self.W2 = data["W2"]
        self.b2 = data["b2"]
        self.W3 = data["W3"]
        self.b3 = data["b3"]

    def to_dict(self) -> dict[str, Any]:
        return {
            "W1": self.W1.tolist(),
            "b1": self.b1.tolist(),
            "W2": self.W2.tolist(),
            "b2": self.b2.tolist(),
            "W3": self.W3.tolist(),
            "b3": self.b3.tolist(),
        }

    def from_dict(self, data: dict[str, Any]) -> None:
        self.W1 = np.array(data["W1"])
        self.b1 = np.array(data["b1"])
        self.W2 = np.array(data["W2"])
        self.b2 = np.array(data["b2"])
        self.W3 = np.array(data["W3"])
        self.b3 = np.array(data["b3"])


def train_models(
    df: pd.DataFrame, feature_cols: list[str]
) -> tuple[TinyMLP, TinyMLP, dict[str, float]]:
    X = df[feature_cols].values
    y_eta = df["eta_minutes"].values
    y_fare = df["fare_cop"].values

    # Normalización
    mean = X.mean(axis=0)
    std = X.std(axis=0) + 1e-8
    X_norm = (X - mean) / std

    split = int(0.8 * len(X_norm))
    X_train, X_test = X_norm[:split], X_norm[split:]
    y_eta_train, y_eta_test = y_eta[:split], y_eta[split:]
    y_fare_train, y_fare_test = y_fare[:split], y_fare[split:]

    eta_model = TinyMLP(input_size=len(feature_cols), hidden_size=16)
    eta_model.fit(X_train, y_eta_train)
    eta_r2 = r2_score(y_eta_test, eta_model.predict(X_test).flatten())

    fare_model = TinyMLP(input_size=len(feature_cols), hidden_size=16)
    # Keep the target in a range comparable to the network weights. Training
    # directly with COP values makes this small NumPy model diverge.
    fare_model.fit(X_train, y_fare_train / FARE_TARGET_SCALE)
    fare_r2 = r2_score(y_fare_test, fare_model.predict(X_test).flatten() * FARE_TARGET_SCALE)
    logger.info("Modelos entrenados: R2 ETA=%.3f, R2 tarifa=%.3f", eta_r2, fare_r2)

    return eta_model, fare_model, {
        "mean": mean.tolist(),
        "std": std.tolist(),
        "fare_scale": FARE_TARGET_SCALE,
    }


def r2_score(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    ss_res = np.sum((y_true - y_pred) ** 2)
    ss_tot = np.sum((y_true - np.mean(y_true)) ** 2)
    return float(1 - ss_res / ss_tot) if ss_tot > 0 else 0.0
