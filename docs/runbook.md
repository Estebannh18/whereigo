# docs/runbook.md — Operación de Whereigo?

Qué hacer cuando Nagios avisa. Cada alerta de Telegram trae el enlace a la sección que corresponde.

Antes de tocar nada: en el panel de Nagios (http://localhost:8080/nagios), **Acknowledge** sobre el problema, para que el otro integrante sepa que ya alguien lo está atendiendo y no lleguen más avisos repetidos.

## Arrancar y detener la operación

```bash
cp ops/nagios/.env.example ops/nagios/.env
docker compose -f ops/nagios/docker-compose.yml up -d --build
docker compose -f ops/nagios/docker-compose.yml logs -f nagios
docker compose -f ops/nagios/docker-compose.yml down
```

Nagios solo revisa dentro de la ventana `whereigo-operacion` (ver `ops/nagios/config/00-timeperiods.cfg`). Fuera de ella no genera tráfico, para no gastar las 750 horas gratis al mes de Render.

Antes de un despliegue planeado o de la demo: en Nagios, **Schedule downtime** sobre el host que se va a desplegar, para que el reinicio no dispare alertas ni el redeploy automático.

## frontend-caido

1. Abrir el dominio de Vercel en el navegador. Si carga, era un fallo momentáneo: esperar la recuperación.
2. Si no carga: Vercel → Deployments → **Instant Rollback** al último despliegue que funcionaba.
3. Revisar el log del build fallido y abrir una tarjeta en Trello.

## servicio-caido

Nagios ya intentó un redeploy automático en Render (máximo uno cada 30 minutos por servicio). Si la alerta sigue:

1. Render → el servicio → **Logs**. Buscar el error del arranque.
2. Si el último commit lo rompió: Render → **Rollback** al deploy anterior.
3. Si es el plan gratis sin horas: Render suspende todo al llegar a 750 horas en el mes. Revisar el uso en Billing.

## dependencia-caida

`/health/ready` del auth-service dice qué dependencia falló. Hoy la única es `database` (Postgres).

- `database`: revisar que la base de Render no haya expirado (la gratuita vence a los **30 días** de creada). Restaurar desde el último `pg_dump`.

## modelo-no-cargado

El ai-service responde pero `model_loaded=false`: no pudo cargar ni entrenar los modelos al arrancar.

1. Revisar en los logs del ai-service el arranque: debe aparecer "Modelos cargados desde app/models/" o "Modelos entrenados: R2 ETA=...".
2. Si falló al escribir `app/models/`: revisar permisos del contenedor (corre como `appuser`).
3. Redesplegar la última versión buena del ai-service.

## eta-fuera-de-rango

La transacción login → ETA devolvió un tiempo imposible (menos de 1 o más de 180 minutos) o no devolvió ETA.

1. Mirar la versión del modelo en la alerta (`model_version`). Si cambió hace poco, volver a la versión anterior.
2. Si el ai-service recibe tráfico por RabbitMQ (`RABBITMQ_ENABLED=true`), revisar `/traffic-state`: congestión fuera de 0–100 dispara ETAs absurdos.
3. Si falló el login: revisar que la cuenta de monitoreo siga existiendo en auth-service.

## modelo-degradado

Prometheus disparó `WhereigoModeloDegradado`: el MAE móvil del ETA (`/feedback`) superó el umbral.

1. En Grafana, panel "MAE móvil del modelo": ver desde cuándo subió y si coincide con un despliegue (`model_version`).
2. Si coincide con una versión nueva: redesplegar la anterior.
3. Si no: los datos reales cambiaron (drift). Reentrenar y subir `MODEL_VERSION`.

## Rotar secretos

1. Generar el valor nuevo en la plataforma (Render, Telegram, deploy hook).
2. Actualizar GitHub Secrets / env group de Render / `ops/nagios/.env`.
3. `docker compose -f ops/nagios/docker-compose.yml up -d` para que Nagios lo tome.
