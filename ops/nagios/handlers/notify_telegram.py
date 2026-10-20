#!/usr/bin/env python3
# ops/nagios/handlers/notify_telegram.py
"""Comando de notificación de Nagios: envía la alerta al Telegram del contacto.

El token del bot se lee del archivo de secretos; el chat_id llega en
$CONTACTPAGER$. El mensaje incluye el enlace al runbook del servicio.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "plugins"))
from whereigo_common import load_secrets

ICONS = {"CRITICAL": "🔴", "DOWN": "🔴", "WARNING": "🟠", "UNKNOWN": "⚪", "OK": "🟢", "UP": "🟢"}
TELEGRAM_API = os.environ.get("WHEREIGO_TELEGRAM_API", "https://api.telegram.org")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--chat", default="")
    parser.add_argument("--type", default="PROBLEM")
    parser.add_argument("--host", required=True)
    parser.add_argument("--service", default="")
    parser.add_argument("--state", required=True)
    parser.add_argument("--output", default="")
    parser.add_argument("--runbook", default="")
    return parser.parse_args()


def build_message(args: argparse.Namespace) -> str:
    target = f"{args.host} / {args.service}" if args.service else args.host
    lines = [
        f"{ICONS.get(args.state, '🔔')} Whereigo? · {args.type}",
        f"{target}: {args.state}",
        args.output,
    ]
    if args.runbook:
        lines.append(f"Runbook: {args.runbook}")
    return "\n".join(line for line in lines if line)


def main() -> int:
    args = parse_args()
    token = load_secrets().get("TELEGRAM_BOT_TOKEN", "")
    if not token or not args.chat:
        print("[notify] Telegram sin configurar (token o chat_id vacio)")
        return 0

    payload = json.dumps({"chat_id": args.chat, "text": build_message(args)}).encode("utf-8")
    request = urllib.request.Request(
        f"{TELEGRAM_API}/bot{token}/sendMessage",
        data=payload,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            print(f"[notify] enviado a {args.chat} (HTTP {response.status})")
    except urllib.error.URLError as error:
        print(f"[notify] fallo el envio ({type(error).__name__})")  # sin la URL: lleva el token
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
