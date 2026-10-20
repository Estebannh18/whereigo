# ops/nagios/config/40-services.cfg.tpl
# Qué se revisa en cada parte. notes_url lleva al runbook para que quien recibe
# la alerta sepa qué hacer sin depender de la memoria de nadie.

define service {
    name                    whereigo-service
    check_period            ${WHEREIGO_PERIOD}
    check_interval          5
    retry_interval          1
    max_check_attempts      3
    notification_period     ${WHEREIGO_PERIOD}
    notification_interval   30
    notification_options    w,c,u,r
    notifications_enabled   1
    flap_detection_enabled  1
    process_perf_data       1
    register                0
}

# --- 1. Presentación ---------------------------------------------------------

define service {
    use                     whereigo-service
    host_name               frontend
    service_description     Pagina principal
    check_command           whereigo_check_frontend!3!10
    contact_groups          resp-juanes
    notes_url               ${WHEREIGO_REPO_URL}/blob/main/docs/runbook.md#frontend-caido
}

# --- 2. Acceso: gateway y auth-service (NestJS) ------------------------------

define service {
    use                     whereigo-service
    hostgroup_name          acceso
    service_description     Disponibilidad /health
    check_command           whereigo_check_health!/health!3!10!
    ; Si queda CRITICAL (HARD), Nagios redespliega el servicio en Render.
    event_handler           whereigo_redeploy_render
    event_handler_enabled   1
    contact_groups          equipo-whereigo
    notes_url               ${WHEREIGO_REPO_URL}/blob/main/docs/runbook.md#servicio-caido
}

define service {
    use                     whereigo-service
    ; Solo auth-service tiene dependencias propias (Postgres).
    host_name               auth-service
    service_description     Dependencias /health/ready
    check_command           whereigo_check_health!/health/ready!3!10!
    contact_groups          equipo-whereigo
    notes_url               ${WHEREIGO_REPO_URL}/blob/main/docs/runbook.md#dependencia-caida
}

# --- 3. Inteligencia: modelo de IA ------------------------------------------

define service {
    use                     whereigo-service
    host_name               ai-service
    service_description     Disponibilidad y modelo cargado
    ; Además de responder, el ai-service debe tener los modelos TinyMLP en memoria.
    check_command           whereigo_check_health!/health!3!10!--require model_loaded
    event_handler           whereigo_redeploy_render
    event_handler_enabled   1
    contact_groups          resp-juanjo
    notes_url               ${WHEREIGO_REPO_URL}/blob/main/docs/runbook.md#modelo-no-cargado
}

define service {
    use                     whereigo-service
    host_name               ai-service
    service_description     Dependencias /health/ready
    ; Modelo y, si RABBITMQ_ENABLED=true, la conexión con RabbitMQ.
    check_command           whereigo_check_health!/health/ready!3!10!
    contact_groups          resp-juanjo
    notes_url               ${WHEREIGO_REPO_URL}/blob/main/docs/runbook.md#dependencia-caida
}

# Transacción sintética: un usuario de monitoreo hace login y pide un ETA real
# por el gateway. Prueba gateway + auth + IA juntos, como lo vive el usuario.
define service {
    use                     whereigo-service
    host_name               gateway
    service_description     Transaccion login a ETA
    check_command           whereigo_check_eta!5!15
    check_interval          10
    contact_groups          resp-juanjo
    notes_url               ${WHEREIGO_REPO_URL}/blob/main/docs/runbook.md#eta-fuera-de-rango
}
