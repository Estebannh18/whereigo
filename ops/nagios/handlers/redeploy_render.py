#!/usr/bin/env python3
# ops/nagios/handlers/redeploy_render.py
"""Event handler de Nagios: redespliega en Render un servicio que quedó caído.

Nagios lo llama en cada cambio de estado. Solo actúa cuando el servicio está
CRITICAL en estado HARD (ya falló todos los reintentos), y como máximo una vez
cada COOLDOWN minutos por servicio, para no entrar en un ciclo de redeploys si
la falla es de código y no de la instancia.

La URL del deploy hook es un secreto (quien la tenga puede desplegar): se lee
del archivo de secretos y nunca se imprime en el log.
"""
from __future__ import annotations

import argparse
import os
import sys
import time
import urllib.error
import urllib.request

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "plugins"))
from whereigo_common import load_secrets

STATE_DIR = os.environ.get("WHEREIGO_STATE_DIR", "/opt/nagios/var/whereigo")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", required=True)
    parser.add_argument("--state", required=True)
    parser.add_argument("--state-type", required=True)
    parser.add_argument("--hook-var", default="", help="nombre de la variable con el hook")
    parser.add_argument("--cooldown-min", type=float, default=30.0)
    return parser.parse_args()


def in_cooldown(host: str, cooldown_min: float) -> bool:
    marker = os.path.join(STATE_DIR, f"redeploy-{host}.last")
    try:
        return (time.time() - os.path.getmtime(marker)) < cooldown_min * 60
    except FileNotFoundError:
        return False


def mark_redeploy(host: str) -> None:
    os.makedirs(STATE_DIR, exist_ok=True)
    with open(os.path.join(STATE_DIR, f"redeploy-{host}.last"), "w", encoding="utf-8") as handle:
        handle.write(str(int(time.time())))


def main() -> int:
    args = parse_args()
    if args.state != "CRITICAL" or args.state_type != "HARD":
        return 0  # SOFT o recuperación: todavía no se actúa.

    hook_url = load_secrets().get(args.hook_var, "") if args.hook_var else ""
    if not hook_url:
        print(f"[redeploy] {args.host}: sin deploy hook configurado, no se hace nada")
        return 0
    if in_cooldown(args.host, args.cooldown_min):
        print(f"[redeploy] {args.host}: ya se redesplego hace menos de {args.cooldown_min:.0f} min")
        return 0

    request = urllib.request.Request(hook_url, data=b"", method="POST")
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            print(f"[redeploy] {args.host}: redeploy solicitado a Render (HTTP {response.status})")
    except urllib.error.URLError as error:
        # Solo el tipo de error: el mensaje podría incluir la URL con su clave.
        print(f"[redeploy] {args.host}: fallo la llamada al hook ({type(error).__name__})")
        return 1
    mark_redeploy(args.host)
    return 0


if __name__ == "__main__":
    sys.exit(main())
