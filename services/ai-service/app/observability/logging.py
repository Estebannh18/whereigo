# services/ai-service/app/observability/logging.py
"""Logs en JSON (una línea por evento) para poder filtrarlos en Render o cualquier colector.

Los campos extra se pasan con `extra={"event": ..., ...}`. Nunca registrar tokens,
contraseñas ni datos personales: las predicciones se registran con las variables
del modelo (distancia, congestión, hora...), no con las coordenadas del usuario.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import UTC, datetime

# Atributos que trae todo LogRecord; lo demás son campos extra del evento.
_RESERVED = set(vars(logging.makeLogRecord({}))) | {"message", "asctime"}


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "ts": datetime.fromtimestamp(record.created, UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "service": "ai-service",
        }
        entry.update({key: value for key, value in vars(record).items() if key not in _RESERVED})
        if record.exc_info:
            entry["exc"] = self.formatException(record.exc_info)
        return json.dumps(entry, ensure_ascii=False, default=str)


def setup_logging() -> None:
    """LOG_FORMAT=json (por defecto) o text para leerlos más cómodo en local."""
    handler = logging.StreamHandler()
    if os.getenv("LOG_FORMAT", "json").lower() == "json":
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(os.getenv("LOG_LEVEL", "INFO").upper())
