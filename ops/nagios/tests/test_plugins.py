# ops/nagios/tests/test_plugins.py
"""Pruebas de los plugins de Nagios contra un servidor HTTP falso.

Se ejecutan los plugins igual que los ejecuta Nagios (como proceso) y se
revisa el código de salida (0 OK, 1 WARNING, 2 CRITICAL, 3 UNKNOWN).
Correr con:  python -m pytest ops/nagios/tests -q
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
HEALTH = ROOT / "plugins" / "check_whereigo_health.py"
ETA = ROOT / "plugins" / "check_whereigo_eta.py"
REDEPLOY = ROOT / "handlers" / "redeploy_render.py"

# Respuestas simuladas: ruta -> (código HTTP, cuerpo, retardo en segundos)
ROUTES = {
    "/ok/health": (200, {"status": "ok", "info": {}, "error": {}, "details": {}}, 0),
    "/degraded/health/ready": (
        503,
        {
            "status": "error",
            "info": {"database": {"status": "up"}},
            "error": {"rabbitmq": {"status": "down"}},
            "details": {"database": {"status": "up"}, "rabbitmq": {"status": "down"}},
        },
        0,
    ),
    "/ai-ok/health": (200, {"status": "ok", "model_loaded": True, "model_version": "tinymlp-1.0"}, 0),
    "/ai-nomodel/health": (200, {"status": "ok", "model_loaded": False}, 0),
    "/slow/health": (200, {"status": "ok"}, 1.2),
    "/html/health": (200, "<html>no soy json</html>", 0),
}
ETA_RESPONSES = {"good": {"eta_minutes": 27.5, "model_version": "tinymlp-1.0"}, "absurd": {"eta_minutes": 900}}
HOOK_CALLS: list[str] = []


class FakeWhereigo(BaseHTTPRequestHandler):
    def log_message(self, *args):  # silenciar el log del servidor de pruebas
        pass

    def _send(self, status: int, body) -> None:
        raw = body if isinstance(body, str) else json.dumps(body)
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(raw.encode())

    def do_GET(self):
        status, body, delay = ROUTES.get(self.path, (404, {"message": "not found"}, 0))
        time.sleep(delay)
        self._send(status, body)

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        payload = json.loads(self.rfile.read(length) or b"{}")
        if self.path.endswith("/auth/login"):
            ok = payload.get("password") == "clave-monitor"
            self._send(200 if ok else 401, {"accessToken": "jwt-falso"} if ok else {"message": "x"})
        elif self.path.endswith("/ai/predict"):
            if self.headers.get("Authorization") != "Bearer jwt-falso":
                self._send(401, {"message": "unauthorized"})
                return
            scenario = self.path.split("/")[1]
            self._send(200, ETA_RESPONSES[scenario])
        elif self.path.startswith("/deploy/"):
            HOOK_CALLS.append(self.path)
            self._send(200, {"deploy": "queued"})
        else:
            self._send(404, {})


@pytest.fixture(scope="module")
def server():
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), FakeWhereigo)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{httpd.server_port}"
    httpd.shutdown()


@pytest.fixture()
def secrets(tmp_path, server):
    path = tmp_path / "secrets.env"
    path.write_text(
        "MONITOR_USER_EMAIL=monitor@whereigo.test\n"
        "MONITOR_USER_PASSWORD=clave-monitor\n"
        f"RENDER_HOOK_GATEWAY={server}/deploy/gateway?key=secreta\n"
    )
    return path


def run(script: Path, *args: str, secrets_file: Path | None = None, state_dir: Path | None = None):
    env = dict(os.environ)
    if secrets_file:
        env["WHEREIGO_SECRETS_FILE"] = str(secrets_file)
    if state_dir:
        env["WHEREIGO_STATE_DIR"] = str(state_dir)
    done = subprocess.run([sys.executable, str(script), *args], check=False, capture_output=True, text=True, env=env, timeout=30)
    return done.returncode, done.stdout.strip()


# --- check_whereigo_health -------------------------------------------------

def test_servicio_sano_da_ok(server):
    code, out = run(HEALTH, "--url", f"{server}/ok/health")
    assert code == 0 and out.startswith("OK"), out
    assert "| time=" in out  # perfdata para graficar


def test_dependencia_caida_da_critical_y_la_nombra(server):
    code, out = run(HEALTH, "--url", f"{server}/degraded/health/ready")
    assert code == 2
    assert "rabbitmq" in out and "database" not in out.split("|")[0]


def test_modelo_no_cargado_da_critical(server):
    code, out = run(HEALTH, "--url", f"{server}/ai-nomodel/health", "--require", "model_loaded")
    assert code == 2 and "model_loaded=False" in out


def test_modelo_cargado_muestra_version(server):
    code, out = run(HEALTH, "--url", f"{server}/ai-ok/health", "--require", "model_loaded")
    assert code == 0 and "tinymlp-1.0" in out


def test_respuesta_lenta_da_warning(server):
    code, out = run(HEALTH, "--url", f"{server}/slow/health", "-w", "0.5", "-c", "5")
    assert code == 1 and "arranque en frio" in out


def test_respuesta_no_json_da_critical(server):
    code, _ = run(HEALTH, "--url", f"{server}/html/health")
    assert code == 2


def test_servicio_inalcanzable_da_critical():
    code, out = run(HEALTH, "--url", "http://127.0.0.1:9/health", "-t", "2")
    assert code == 2 and "sin respuesta" in out


# --- check_whereigo_eta ----------------------------------------------------

def test_transaccion_eta_correcta(server, secrets):
    code, out = run(ETA, "--base-url", f"{server}/good", secrets_file=secrets)
    assert code == 0, out
    assert "ETA 27.5 min" in out and "eta_minutes=27.5" in out


def test_eta_absurdo_da_critical(server, secrets):
    code, out = run(ETA, "--base-url", f"{server}/absurd", secrets_file=secrets)
    assert code == 2 and "fuera del rango" in out


def test_sin_credenciales_da_unknown(server, tmp_path):
    empty = tmp_path / "vacio.env"
    empty.write_text("")
    code, _ = run(ETA, "--base-url", f"{server}/good", secrets_file=empty)
    assert code == 3


# --- redeploy_render -------------------------------------------------------

def test_redeploy_solo_en_critical_hard_y_con_cooldown(server, secrets, tmp_path):
    HOOK_CALLS.clear()
    base = ["--host", "gateway", "--hook-var", "RENDER_HOOK_GATEWAY"]

    run(REDEPLOY, *base, "--state", "CRITICAL", "--state-type", "SOFT", secrets_file=secrets, state_dir=tmp_path)
    assert HOOK_CALLS == []  # SOFT: todavía en reintentos

    hard = ["--state", "CRITICAL", "--state-type", "HARD"]
    code, out = run(REDEPLOY, *base, *hard, secrets_file=secrets, state_dir=tmp_path)
    assert code == 0 and len(HOOK_CALLS) == 1
    assert "secreta" not in out  # la URL del hook nunca sale en el log

    run(REDEPLOY, *base, *hard, secrets_file=secrets, state_dir=tmp_path)
    assert len(HOOK_CALLS) == 1  # cooldown: no redespliega en bucle
