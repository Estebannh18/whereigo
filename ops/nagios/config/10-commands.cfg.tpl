# ops/nagios/config/10-commands.cfg.tpl
# Comandos propios de Whereigo. $USER1$ = plugins estándar de Nagios
# (/opt/nagios/libexec). Los plugins y handlers propios viven en /opt/whereigo.
#
# Plantilla: el entrypoint pone el esquema según el modo.
#   Render (por defecto): WHEREIGO_SCHEME=https, puerto 443 y check_http con --ssl.
#   Local (docker compose): WHEREIGO_SCHEME=http y el puerto de cada contenedor.
# $_HOSTPORT$ es la variable _PORT de cada host (30-hosts.cfg.tpl).

# --- Chequeos de host -------------------------------------------------------

# Un host "está arriba" si responde en su ruta de salud. Timeout de 60 s
# porque un servicio gratuito de Render tarda en despertar (arranque en frío).
define command {
    command_name    whereigo_check_host_https
    command_line    $USER1$/check_http -H $HOSTADDRESS$ -p $_HOSTPORT$ ${WHEREIGO_HTTP_SSL} -u $_HOSTHEALTH_PATH$ -t 60
}

# --- Chequeos de servicio ---------------------------------------------------

# Salud de un microservicio leyendo su JSON (@nestjs/terminus o FastAPI).
# ARG1 = ruta, ARG2 = seg. para WARNING, ARG3 = seg. para CRITICAL,
# ARG4 = opciones extra (p. ej. --require model_loaded).
define command {
    command_name    whereigo_check_health
    command_line    /usr/bin/python3 /opt/whereigo/plugins/check_whereigo_health.py --url ${WHEREIGO_SCHEME}://$HOSTADDRESS$:$_HOSTPORT$$ARG1$ --warning $ARG2$ --critical $ARG3$ $ARG4$
}

# Transacción sintética de punta a punta: login -> estimación de ETA.
define command {
    command_name    whereigo_check_eta
    command_line    /usr/bin/python3 /opt/whereigo/plugins/check_whereigo_eta.py --base-url ${WHEREIGO_SCHEME}://$HOSTADDRESS$:$_HOSTPORT$ --warning $ARG1$ --critical $ARG2$
}

# El frontend (Vercel o Vite en local) entrega el index.html con el contenedor de React.
define command {
    command_name    whereigo_check_frontend
    command_line    $USER1$/check_http -H $HOSTADDRESS$ -p $_HOSTPORT$ ${WHEREIGO_HTTP_SSL} -u / -s 'id="root"' -w $ARG1$ -c $ARG2$ -t 30
}

# RabbitMQ administrado (CloudAMQP): el puerto AMQPS acepta conexión TLS.
define command {
    command_name    whereigo_check_amqps
    command_line    $USER1$/check_tcp -H $HOSTADDRESS$ -p 5671 --ssl -w 2 -c 5 -t 15
}

# --- Manejadores de eventos -------------------------------------------------

# Auto-remediación: si un servicio queda CRITICAL en estado HARD, redespliega
# ese servicio en Render con su deploy hook (equivale a reiniciarlo).
define command {
    command_name    whereigo_redeploy_render
    command_line    /usr/bin/python3 /opt/whereigo/handlers/redeploy_render.py --host "$HOSTNAME$" --state $SERVICESTATE$ --state-type $SERVICESTATETYPE$ --hook-var $_HOSTRENDER_HOOK$
}

# --- Notificaciones (Telegram) ---------------------------------------------

define command {
    command_name    whereigo_notify_service_telegram
    command_line    /usr/bin/python3 /opt/whereigo/handlers/notify_telegram.py --chat "$CONTACTPAGER$" --type "$NOTIFICATIONTYPE$" --host "$HOSTALIAS$" --service "$SERVICEDESC$" --state "$SERVICESTATE$" --output "$SERVICEOUTPUT$" --runbook "$SERVICENOTESURL$"
}

define command {
    command_name    whereigo_notify_host_telegram
    command_line    /usr/bin/python3 /opt/whereigo/handlers/notify_telegram.py --chat "$CONTACTPAGER$" --type "$NOTIFICATIONTYPE$" --host "$HOSTALIAS$" --state "$HOSTSTATE$" --output "$HOSTOUTPUT$"
}
