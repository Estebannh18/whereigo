#!/usr/bin/env python3
# ops/nagios/plugins/check_whereigo_health.py
"""Plugin de Nagios: salud de un microservicio de Whereigo?.

Entiende los dos formatos de /health del proyecto:
  - NestJS + @nestjs/terminus: {"status": "ok"|"error", "details": {"database": {"status": "up"}, ...}}
  - ai-service (FastAPI):      {"status": "ok", "model_loaded": true, "model_version": "tinymlp-1.0"}

Ejemplos:
  check_whereigo_health.py --url https://gw.onrender.com/health/ready -w 3 -c 10
  check_whereigo_health.py --url https://ai.onrender.com/health --require model_loaded
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
    nagios_exit,
)

HEALTHY_STATUSES = {"ok", "up"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    parser.add_argument("-w", "--warning", type=float, default=3.0, help="segundos")
    parser.add_argument("-c", "--critical", type=float, default=10.0, help="segundos")
    parser.add_argument("-t", "--timeout", type=float, default=60.0)
    parser.add_argument(
        "--require",
        action="append",
        default=[],
        metavar="CLAVE",
        help="clave booleana del JSON que debe ser true (repetible)",
    )
    return parser.parse_args()


def failing_dependencies(body: dict) -> list[str]:
    """Nombres de las dependencias que terminus reporta caídas."""
    failing = set((body.get("error") or {}).keys())
    for name, detail in (body.get("details") or {}).items():
        if isinstance(detail, dict) and detail.get("status") not in HEALTHY_STATUSES:
            failing.add(name)
    return sorted(failing)


def evaluate(status_code: int, body, elapsed: float, args: argparse.Namespace) -> tuple[int, str]:
    if not isinstance(body, dict):
        return CRITICAL, f"HTTP {status_code}, la respuesta no es JSON"

    problems: list[str] = []
    failing = failing_dependencies(body)
    if failing:
        problems.append("dependencias caidas: " + ", ".join(failing))
    if status_code != 200 or str(body.get("status", "")).lower() not in HEALTHY_STATUSES:
        problems.append(f"HTTP {status_code}, status={body.get('status')!r}")
    for key in args.require:
        if body.get(key) is not True:
            problems.append(f"{key}={body.get(key)!r}")

    if problems:
        return CRITICAL, "; ".join(problems)

    state = latency_state(elapsed, args.warning, args.critical)
    message = f"responde en {elapsed:.2f}s"
    if "model_version" in body:
        message += f", modelo {body['model_version']}"
    if state != OK:
        message += " (lento: posible arranque en frio)"
    return state, message


def main() -> None:
    args = parse_args()
    try:
        result = http_json(args.url, timeout=args.timeout)
    except (urllib.error.URLError, TimeoutError) as error:
        nagios_exit(CRITICAL, f"sin respuesta de {args.url}: {error}")
    except Exception as error:  # noqa: BLE001 - error inesperado del propio plugin -> UNKNOWN
        nagios_exit(UNKNOWN, f"error del plugin: {error}")

    state, message = evaluate(result.status, result.body, result.elapsed, args)
    perf = f"time={result.elapsed:.3f}s;{args.warning};{args.critical};0"
    nagios_exit(state, message, perf)


if __name__ == "__main__":
    main()
