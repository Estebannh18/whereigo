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

    def __init__(self, input_size: int, hidden_size: int = 16, output_size: int = 1):
        rng = np.random.default_rng(42)
        self.W1 = rng.normal(0, 0.1, (input_size, hidden_size))
        self.b1 = np.zeros((1, hidden_size))
        self.W2 = rng.normal(0, 0.1, (hidden_size, hidden_size // 2))
        self.b2 = np.zeros((1, hidden_size // 2))
        self.W3 = rng.normal(0, 0.1, (hidden_size // 2, output_size))
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

    def fit(self, X: np.ndarray, y: np.ndarray, epochs: int = 300, lr: float = 0.01) -> None:
        n = X.shape[0]
        y = y.reshape(-1, 1) if y.ndim == 1 else y
        for epoch in range(epochs):
            # Forward
            z1 = X @ self.W1 + self.b1
            a1 = self.relu(z1)
            z2 = a1 @ self.W2 + self.b2
            a2 = self.relu(z2)
            z3 = a2 @ self.W3 + self.b3

            # Backprop
            dz3 = (z3 - y) / n
            dW3 = a2.T @ dz3
            db3 = np.sum(dz3, axis=0, keepdims=True)
            da2 = dz3 @ self.W3.T
            dz2 = da2 * (z2 > 0)
            dW2 = a1.T @ dz2
            db2 = np.sum(dz2, axis=0, keepdims=True)
            da1 = dz2 @ self.W2.T
            dz1 = da1 * (z1 > 0)
            dW1 = X.T @ dz1
            db1 = np.sum(dz1, axis=0, keepdims=True)

            # Update
            self.W3 -= lr * dW3
            self.b3 -= lr * db3
            self.W2 -= lr * dW2
            self.b2 -= lr * db2
            self.W1 -= lr * dW1
            self.b1 -= lr * db1

            if epoch % 100 == 0:
                loss = np.mean((z3 - y) ** 2)
                print(f"Epoch {epoch}, loss: {loss:.4f}")

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
    eta_model.fit(X_train, y_eta_train, epochs=300, lr=0.02)
    eta_r2 = r2_score(y_eta_test, eta_model.predict(X_test).flatten())

    fare_model = TinyMLP(input_size=len(feature_cols), hidden_size=16)
    # Keep the target in a range comparable to the network weights. Training
    # directly with COP values makes this small NumPy model diverge.
    fare_model.fit(X_train, y_fare_train / FARE_TARGET_SCALE, epochs=300, lr=0.02)
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
