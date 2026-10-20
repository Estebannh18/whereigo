#!/bin/sh
# ops/nagios/entrypoint.sh
# Prepara la configuración de Whereigo y arranca Nagios (imagen jasonrivers/nagios).
#   1. Valida que el .env traiga todas las variables obligatorias.
#   2. Rinde las plantillas *.cfg.tpl con envsubst.
#   3. Escribe los secretos en /run/whereigo (fuera de la config, permisos 640).
#   4. Valida la configuración con "nagios -v" ANTES de arrancar.
set -eu

NAGIOS_HOME=/opt/nagios
NAGIOS_CFG="$NAGIOS_HOME/etc/nagios.cfg"
TARGET="$NAGIOS_HOME/etc/whereigo"
TEMPLATES=/opt/whereigo/config
SECRETS_DIR=/run/whereigo

REQUIRED="WHEREIGO_FRONTEND_HOST WHEREIGO_GATEWAY_HOST WHEREIGO_AUTH_HOST WHEREIGO_AI_HOST WHEREIGO_REPO_URL \
WHEREIGO_TELEGRAM_CHAT_JUANJO WHEREIGO_TELEGRAM_CHAT_JUANES"

for name in $REQUIRED; do
  eval "value=\${$name:-}"
  if [ -z "$value" ]; then
    echo "[whereigo] Falta la variable $name en ops/nagios/.env" >&2
    exit 1
  fi
done

# El panel no arranca con clave vacía ni con la clave por defecto de la imagen.
case "${NAGIOSADMIN_PASS:-}" in
  ""|nagios)
    echo "[whereigo] Define NAGIOSADMIN_PASS en ops/nagios/.env (no vacia ni 'nagios')" >&2
    exit 1 ;;
esac

# Modo: Render (https y puerto 443, por defecto) o local (http y el puerto de cada
# contenedor del docker compose; ver ops/nagios/local.env.example).
WHEREIGO_SCHEME="${WHEREIGO_SCHEME:-https}"
case "$WHEREIGO_SCHEME" in
  https) WHEREIGO_HTTP_SSL="--ssl --sni"; DEFAULT_PORT=443 ;;
  http)  WHEREIGO_HTTP_SSL=""; DEFAULT_PORT=80 ;;
  *) echo "[whereigo] WHEREIGO_SCHEME debe ser https o http" >&2; exit 1 ;;
esac
PORTS="WHEREIGO_FRONTEND_PORT WHEREIGO_GATEWAY_PORT WHEREIGO_AUTH_PORT WHEREIGO_AI_PORT"
for name in $PORTS; do
  eval "value=\${$name:-$DEFAULT_PORT}"
  eval "$name=\$value"
done
# Ventana de revisión: whereigo-operacion (cuida las horas gratis de Render) o
# whereigo-24x7 (modo local). Ver config/00-timeperiods.cfg.
WHEREIGO_PERIOD="${WHEREIGO_PERIOD:-whereigo-operacion}"
export WHEREIGO_SCHEME WHEREIGO_HTTP_SSL WHEREIGO_PERIOD $PORTS

# Lista explícita: envsubst solo toca estas variables y deja intactas las
# macros de Nagios ($HOSTADDRESS$, $ARG1$, ...).
SUBST_VARS=""
for name in $REQUIRED WHEREIGO_SCHEME WHEREIGO_HTTP_SSL WHEREIGO_PERIOD $PORTS; do SUBST_VARS="$SUBST_VARS \${$name}"; done

# Primer arranque con el volumen vacío: copiar la config base de la imagen.
if [ ! -f "$NAGIOS_CFG" ] && [ -d /orig/etc ]; then
  cp -Rp /orig/etc/. "$NAGIOS_HOME/etc/"
fi

mkdir -p "$TARGET"
rm -f "$TARGET"/*.cfg
for file in "$TEMPLATES"/*; do
  name=$(basename "$file")
  case "$name" in
    *.tpl) envsubst "$SUBST_VARS" < "$file" > "$TARGET/${name%.tpl}" ;;
    *.cfg) cp "$file" "$TARGET/$name" ;;
  esac
done

# Secretos: solo legibles por root y el grupo nagios. Nunca dentro de etc/.
mkdir -p "$SECRETS_DIR"
umask 027
{
  printf 'TELEGRAM_BOT_TOKEN=%s\n' "${TELEGRAM_BOT_TOKEN:-}"
  printf 'MONITOR_USER_EMAIL=%s\n' "${MONITOR_USER_EMAIL:-}"
  printf 'MONITOR_USER_PASSWORD=%s\n' "${MONITOR_USER_PASSWORD:-}"
  for hook in GATEWAY AUTH AI; do
    eval "value=\${RENDER_HOOK_$hook:-}"
    printf 'RENDER_HOOK_%s=%s\n' "$hook" "$value"
  done
} > "$SECRETS_DIR/secrets.env"
chown -R root:nagios "$SECRETS_DIR"
chmod 750 "$SECRETS_DIR"
chmod 640 "$SECRETS_DIR/secrets.env"
umask 022

# Registrar la carpeta en nagios.cfg (idempotente) y fijar la zona horaria.
grep -q "^cfg_dir=$TARGET\$" "$NAGIOS_CFG" || echo "cfg_dir=$TARGET" >> "$NAGIOS_CFG"
if grep -q '^use_timezone=' "$NAGIOS_CFG"; then
  sed -i "s|^use_timezone=.*|use_timezone=${NAGIOS_TIMEZONE:-America/Bogota}|" "$NAGIOS_CFG"
else
  echo "use_timezone=${NAGIOS_TIMEZONE:-America/Bogota}" >> "$NAGIOS_CFG"
fi

mkdir -p "$NAGIOS_HOME/var/whereigo"
chown nagios:nagios "$NAGIOS_HOME/var/whereigo"

if ! "$NAGIOS_HOME/bin/nagios" -v "$NAGIOS_CFG" > /tmp/nagios-verify.log 2>&1; then
  cat /tmp/nagios-verify.log >&2
  echo "[whereigo] La configuracion de Nagios tiene errores; no se arranca." >&2
  exit 1
fi
echo "[whereigo] Configuracion valida. Arrancando Nagios..."

exec /usr/local/bin/start_nagios
