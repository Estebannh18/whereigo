#!/usr/bin/env bash
# ops/nagios/simulacro.sh — Simulacro de incidente para la fase de Operar (modo local).
#
# Apaga una dependencia del stack local, obliga a Nagios a revisar, muestra cómo lo
# detecta (qué servicio falla y por qué) y la recuperación al volver a encenderla.
#
#   bash ops/nagios/simulacro.sh postgres    # auth-service: /health/ready CRITICAL (database)
#   bash ops/nagios/simulacro.sh rabbitmq    # ai-service:   /health/ready CRITICAL (rabbitmq)
#   bash ops/nagios/simulacro.sh ai-service  # modelo caído + la transacción login -> ETA falla
#
# Requisitos: stack local arriba (docker compose up -d) y Nagios en modo local
# (ver ops/nagios/local.env.example). Correr desde la raíz del repo.
set -euo pipefail

TARGET="${1:-postgres}"
NAGIOS=whereigo-nagios

case "$TARGET" in
  postgres|rabbitmq|ai-service|auth-service) ;;
  *) echo "Uso: $0 [postgres|rabbitmq|ai-service|auth-service]" >&2; exit 1 ;;
esac

forzar_chequeos() {
  # Comando externo de Nagios: revisa ya, sin esperar el intervalo de 5 minutos.
  docker exec "$NAGIOS" sh -c 'now=$(date +%s); for h in frontend gateway auth-service ai-service; do
    printf "[%s] SCHEDULE_FORCED_HOST_CHECK;%s;%s\n[%s] SCHEDULE_FORCED_HOST_SVC_CHECKS;%s;%s\n" \
      "$now" "$h" "$now" "$now" "$h" "$now" >> /opt/nagios/var/rw/nagios.cmd; done'
}

estado() {
  # Lee status.dat: 0 = OK, 1 = WARNING, 2 = CRITICAL, 3 = UNKNOWN.
  docker exec "$NAGIOS" awk '
    /^(hoststatus|servicestatus) \{/ { tipo=$1; h=""; s="(host)"; st=""; o="" }
    /^\thost_name=/           { sub(/^\thost_name=/, "");           h=$0 }
    /^\tservice_description=/ { sub(/^\tservice_description=/, ""); s=$0 }
    /^\tcurrent_state=/       { sub(/^\tcurrent_state=/, "");       st=$0 }
    /^\tplugin_output=/       { sub(/^\tplugin_output=/, "");       o=$0 }
    /^\t\}/ {
      if (tipo != "" && h != "localhost") {
        split("OK WARNING CRITICAL UNKNOWN", n, " ")
        printf "  %-9s %-13s %-34s %s\n", n[st+1], h, s, substr(o, 1, 60)
      }
      tipo=""
    }' /opt/nagios/var/status.dat
}

esperar() { echo "  (esperando ${1}s a que Nagios termine de revisar...)"; sleep "$1"; }

echo "== 1. Estado inicial"
forzar_chequeos; esperar 30; estado

echo
echo "== 2. Incidente: se apaga $TARGET"
docker compose stop "$TARGET" >/dev/null
forzar_chequeos; esperar 40; estado
echo "  -> En http://localhost:8080/nagios: Problems. El enlace del runbook está en cada servicio."

echo
echo "== 3. Recuperación: se enciende $TARGET"
docker compose start "$TARGET" >/dev/null
esperar 30   # arranque del contenedor y reconexión de los servicios
forzar_chequeos; esperar 30; estado
