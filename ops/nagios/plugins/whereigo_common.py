# ops/nagios/plugins/whereigo_common.py
"""Utilidades compartidas por los plugins y handlers de Nagios de Whereigo?.

Solo usa la librería estándar de Python para no instalar nada extra en el
contenedor de Nagios.
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

# Códigos de salida que Nagios entiende.
OK, WARNING, CRITICAL, UNKNOWN = 0, 1, 2, 3
STATE_NAMES = {OK: "OK", WARNING: "WARNING", CRITICAL: "CRITICAL", UNKNOWN: "UNKNOWN"}

# El entrypoint escribe aquí los secretos (fuera de la carpeta de config de
# Nagios, con permisos 640 root:nagios). Nunca se versionan.
SECRETS_FILE = os.environ.get("WHEREIGO_SECRETS_FILE", "/run/whereigo/secrets.env")
USER_AGENT = "whereigo-nagios/1.0"


@dataclass
class HttpResult:
    status: int
    body: Any          # dict/list si la respuesta es JSON; str si no lo es
    elapsed: float     # segundos


def load_secrets(path: str = SECRETS_FILE) -> dict[str, str]:
    """Lee un archivo KEY=VALUE. Si no existe devuelve {} (el llamador decide)."""
    secrets: dict[str, str] = {}
    try:
        with open(path, encoding="utf-8") as handle:
            for raw in handle:
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                secrets[key.strip()] = value.strip()
    except FileNotFoundError:
        pass
    return secrets


def http_json(
    url: str,
    method: str = "GET",
    payload: dict | None = None,
    headers: dict[str, str] | None = None,
    timeout: float = 30,
) -> HttpResult:
    """Hace la petición y mide el tiempo total.

    Los códigos 4xx/5xx no lanzan excepción: @nestjs/terminus responde 503 con
    un JSON que dice qué dependencia falló, y ese detalle es justo lo que se
    quiere mostrar en la alerta. Solo los errores de red se propagan.
    """
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(url, data=data, method=method)
    request.add_header("User-Agent", USER_AGENT)
    request.add_header("Accept", "application/json")
    if data is not None:
        request.add_header("Content-Type", "application/json")
    for key, value in (headers or {}).items():
        request.add_header(key, value)

    started = time.monotonic()
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            status, raw = response.status, response.read()
    except urllib.error.HTTPError as error:
        status, raw = error.code, error.read()
    elapsed = time.monotonic() - started

    text = raw.decode("utf-8", errors="replace")
    try:
        body: Any = json.loads(text)
    except json.JSONDecodeError:
        body = text
    return HttpResult(status=status, body=body, elapsed=elapsed)


def latency_state(elapsed: float, warning: float, critical: float) -> int:
    if elapsed >= critical:
        return CRITICAL
    if elapsed >= warning:
        return WARNING
    return OK


def nagios_exit(state: int, message: str, perfdata: str = "") -> None:
    """Imprime en el formato de Nagios ("ESTADO - mensaje | métricas") y sale."""
    line = f"{STATE_NAMES[state]} - {message}"
    if perfdata:
        line += f" | {perfdata}"
    print(line)
    sys.exit(state)
