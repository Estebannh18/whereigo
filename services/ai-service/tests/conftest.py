# services/ai-service/tests/conftest.py
"""Configuración común: sin RabbitMQ y con un único arranque de la app."""
import os

import pytest
from fastapi.testclient import TestClient

# Se lee al importar app.main: en pruebas no hay broker al que conectarse.
os.environ.setdefault("RABBITMQ_ENABLED", "false")


@pytest.fixture(scope="session")
def client():
    from app.main import app

    # El "with" ejecuta el lifespan: carga o entrena los modelos una sola vez.
    with TestClient(app) as test_client:
        yield test_client
