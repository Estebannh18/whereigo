# ops/nagios/config/20-contacts.cfg.tpl
# Plantilla: el entrypoint reemplaza las variables ${...} con los valores del .env.
# El campo "pager" guarda el chat_id de Telegram de cada integrante.

define contact {
    contact_name                    juanjo
    alias                           Juan Jose Gamboa
    pager                           ${WHEREIGO_TELEGRAM_CHAT_JUANJO}
    host_notifications_enabled      1
    service_notifications_enabled   1
    host_notification_period        ${WHEREIGO_PERIOD}
    service_notification_period     ${WHEREIGO_PERIOD}
    host_notification_options       d,u,r
    service_notification_options    w,c,u,r
    host_notification_commands      whereigo_notify_host_telegram
    service_notification_commands   whereigo_notify_service_telegram
}

define contact {
    contact_name                    juanes
    alias                           Juan Esteban Hernandez
    pager                           ${WHEREIGO_TELEGRAM_CHAT_JUANES}
    host_notifications_enabled      1
    service_notifications_enabled   1
    host_notification_period        ${WHEREIGO_PERIOD}
    service_notification_period     ${WHEREIGO_PERIOD}
    host_notification_options       d,u,r
    service_notification_options    w,c,u,r
    host_notification_commands      whereigo_notify_host_telegram
    service_notification_commands   whereigo_notify_service_telegram
}

# Responsable de primer nivel por subsistema (reparto tentativo: ajustar al
# reparto definitivo de la tarjeta P3 / CODEOWNERS).
define contactgroup {
    contactgroup_name   resp-juanjo
    alias               Responsable: acceso e inteligencia
    members             juanjo
}

define contactgroup {
    contactgroup_name   resp-juanes
    alias               Responsable: presentacion (frontend)
    members             juanes
}

# Grupo al que se escala si el incidente no se resuelve.
define contactgroup {
    contactgroup_name   equipo-whereigo
    alias               Equipo completo de Whereigo
    members             juanjo,juanes
}
