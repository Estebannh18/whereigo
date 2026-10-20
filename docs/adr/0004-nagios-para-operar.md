# docs/adr/0004-nagios-para-operar.md

# ADR-004: Nagios Core para la fase de Operar

- Estado: aceptada
- Fecha: 2026-10-18

## Contexto

La fase de Operar del ciclo de vida exige una herramienta de la guía del curso (Nagios, Prometheus, ServiceNow o PagerDuty). Whereigo corre en planes gratuitos: frontend en Vercel, microservicios en Render y RabbitMQ en CloudAMQP. Antes solo se pensaba usar UptimeRobot, que dice si una URL responde pero no entiende las dependencias internas ni puede reaccionar.

## Decisión

Usar **Nagios Core 4.5** en un contenedor (`ops/nagios/`) con:

- Un host por parte desplegada y un hostgroup por cada parte del proyecto.
- Plugins propios en Python que leen el JSON de `/health` y `/health/ready`, verifican que el modelo de IA esté cargado y hacen una transacción login → ETA.
- Notificaciones por Telegram, dependencias entre servicios y escalamiento al equipo.
- Event handler que redespliega en Render un servicio caído usando su deploy hook.

Prometheus + Grafana se quedan en la fase de Monitorear (rendimiento y tendencias); Nagios se encarga de que el sistema siga funcionando y de reaccionar ante incidentes.

## Consecuencias

- Los chequeos despiertan los servicios de Render, que da 750 horas gratis al mes por workspace. Por eso Nagios solo revisa dentro de la ventana `whereigo-operacion`.
- Nagios corre fuera de la nube (equipo, VM o Codespaces) mientras haya operación; si se apaga, no hay vigilancia.
- ServiceNow y PagerDuty se descartaron: son de pago y sobran para un equipo de dos personas.
