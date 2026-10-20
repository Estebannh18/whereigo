# ops/nagios/config/30-hosts.cfg.tpl
# Un host por cada parte desplegada de Whereigo: frontend, gateway y los dos
# microservicios del ciclo de vida (auth-service e ai-service). Los hostgroups
# son las partes del proyecto. traffic, route y alert se agregan aquí cuando se
# desplieguen en Render.

# --- Plantillas ------------------------------------------------------------

define host {
    name                    whereigo-host
    check_command           whereigo_check_host_https
    _HEALTH_PATH            /health
    check_period            ${WHEREIGO_PERIOD}
    check_interval          5
    retry_interval          1
    ; 3 intentos: absorben el arranque en frío de Render sin dar falsa alarma.
    max_check_attempts      3
    notification_period     ${WHEREIGO_PERIOD}
    notification_interval   30
    notification_options    d,u,r
    notifications_enabled   1
    event_handler_enabled   1
    flap_detection_enabled  1
    process_perf_data       1
    register                0
}

# --- Hostgroups = partes del proyecto -------------------------------------

define hostgroup {
    hostgroup_name  presentacion
    alias           1. Presentacion (frontend web)
}

define hostgroup {
    hostgroup_name  acceso
    alias           2. Acceso (API Gateway + Auth)
}

define hostgroup {
    hostgroup_name  inteligencia
    alias           4. Inteligencia (ETA, tarifas y preferencias)
}

# --- Hosts ----------------------------------------------------------------

define host {
    use             whereigo-host
    host_name       frontend
    alias           Frontend React (Vercel)
    address         ${WHEREIGO_FRONTEND_HOST}
    _PORT           ${WHEREIGO_FRONTEND_PORT}
    hostgroups      presentacion
    _HEALTH_PATH    /
    contact_groups  resp-juanes
}

define host {
    use             whereigo-host
    host_name       gateway
    alias           API Gateway (NestJS, Render)
    address         ${WHEREIGO_GATEWAY_HOST}
    _PORT           ${WHEREIGO_GATEWAY_PORT}
    hostgroups      acceso
    _RENDER_HOOK    RENDER_HOOK_GATEWAY
    contact_groups  resp-juanjo
}

define host {
    use             whereigo-host
    host_name       auth-service
    alias           Auth Service (NestJS, Render)
    address         ${WHEREIGO_AUTH_HOST}
    _PORT           ${WHEREIGO_AUTH_PORT}
    hostgroups      acceso
    _RENDER_HOOK    RENDER_HOOK_AUTH
    contact_groups  resp-juanjo
}

define host {
    use             whereigo-host
    host_name       ai-service
    alias           AI Service: TinyMLP ETA y tarifas (FastAPI, Render)
    address         ${WHEREIGO_AI_HOST}
    _PORT           ${WHEREIGO_AI_PORT}
    hostgroups      inteligencia
    _RENDER_HOOK    RENDER_HOOK_AI
    contact_groups  resp-juanjo
}
