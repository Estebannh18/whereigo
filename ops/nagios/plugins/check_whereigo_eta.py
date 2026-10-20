#!/usr/bin/env python3
# ops/nagios/plugins/check_whereigo_eta.py
"""Plugin de Nagios: transacción sintética login -> ETA por el API Gateway.

Hace lo mismo que un usuario: inicia sesión con una cuenta de monitoreo y pide
el ETA de un trayecto fijo en Bucaramanga. Así se prueba en una sola revisión
que gateway, auth-service y el modelo de IA (ai-service) funcionan juntos.

Además del "responde o no", valida que la predicción del modelo sea razonable:
un ETA de 0 o de 900 minutos significa que el modelo o sus variables de
entrada están mal, aunque el servicio esté "arriba".
"""
from __future__ import annotations

import argparse
import urllib.error

from whereigo_common import (
    CRITICAL,
    OK,
    UNKNOWN,
    http_json,
    latency_state,
    load_secrets,
    nagios_exit,
)

# Trayecto fijo para que las mediciones sean comparables entre revisiones:
# Centro de Bucaramanga (Parque Santander) -> Cañaveral (Floridablanca).
ROUTE_PROBE = {
    "origin_lat": 7.1193,
    "origin_lon": -73.1227,
    "destination_lat": 7.0700,
    "destination_lon": -73.1040,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--login-path", default="/auth/login")
    parser.add_argument("--eta-path", default="/ai/predict")
    parser.add_argument("-w", "--warning", type=float, default=5.0, help="segundos")
    parser.add_argument("-c", "--critical", type=float, default=15.0, help="segundos")
    parser.add_argument("-t", "--timeout", type=float, default=60.0)
    parser.add_argument("--min-eta", type=float, default=1.0, help="minutos")
    parser.add_argument("--max-eta", type=float, default=180.0, help="minutos")
    return parser.parse_args()


def login(args: argparse.Namespace, email: str, password: str) -> tuple[str | None, float, int]:
    """Devuelve (token, segundos, código HTTP). Acepta accessToken o access_token."""
    result = http_json(
        args.base_url + args.login_path,
        method="POST",
        payload={"email": email, "password": password},
        timeout=args.timeout,
    )
    token = None
    if isinstance(result.body, dict):
        token = result.body.get("accessToken") or result.body.get("access_token")
    return token, result.elapsed, result.status


def check_prediction(body) -> tuple[int, str, float | None]:
    """Valida la respuesta del modelo de ETA (rango plausible y versión)."""
    if not isinstance(body, dict):
        return CRITICAL, "la respuesta de ETA no es JSON", None
    eta = body.get("eta_minutes")
    if not isinstance(eta, (int, float)) or isinstance(eta, bool):
        return CRITICAL, f"respuesta sin eta_minutes numerico: {body}", None
    return OK, f"ETA {eta:.1f} min, modelo {body.get('model_version', 'sin version')}", float(eta)


def main() -> None:
    args = parse_args()
    secrets = load_secrets()
    email = secrets.get("MONITOR_USER_EMAIL")
    password = secrets.get("MONITOR_USER_PASSWORD")
    if not email or not password:
        nagios_exit(UNKNOWN, "faltan MONITOR_USER_EMAIL/MONITOR_USER_PASSWORD en el .env")

    try:
        token, login_time, login_status = login(args, email, password)
        if not token:
            nagios_exit(CRITICAL, f"login fallo (HTTP {login_status})")

        eta_result = http_json(
            args.base_url + args.eta_path,
            method="POST",
            payload=ROUTE_PROBE,
            headers={"Authorization": f"Bearer {token}"},
            timeout=args.timeout,
        )
    except (urllib.error.URLError, TimeoutError) as error:
        nagios_exit(CRITICAL, f"sin respuesta del gateway: {error}")

    if eta_result.status != 200:
        nagios_exit(CRITICAL, f"ETA respondio HTTP {eta_result.status}")

    state, message, eta = check_prediction(eta_result.body)
    total = login_time + eta_result.elapsed
    if state == OK and not (args.min_eta <= eta <= args.max_eta):
        state = CRITICAL
        message += f" fuera del rango plausible [{args.min_eta}, {args.max_eta}]"
    if state == OK:
        state = latency_state(total, args.warning, args.critical)

    perf = (
        f"total={total:.3f}s;{args.warning};{args.critical};0 "
        f"login={login_time:.3f}s eta_request={eta_result.elapsed:.3f}s"
    )
    if eta is not None:
        perf += f" eta_minutes={eta:.1f};;;{args.min_eta};{args.max_eta}"
    nagios_exit(state, f"{message}, transaccion en {total:.2f}s", perf)


if __name__ == "__main__":
    main()
