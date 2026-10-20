# docs/runbook.md — Operación de Whereigo?

Qué hacer cuando Nagios avisa. Cada alerta de Telegram trae el enlace a la sección que corresponde.

Antes de tocar nada: en el panel de Nagios (http://localhost:8080/nagios), **Acknowledge** sobre el problema, para que el otro integrante sepa que ya alguien lo está atendiendo y no lleguen más avisos repetidos.

## Arrancar y detener la operación

**Contra Render** (staging):

```bash
cp ops/nagios/.env.example ops/nagios/.env      # y completar
docker compose -f ops/nagios/docker-compose.yml up -d --build
docker compose -f ops/nagios/docker-compose.yml logs -f nagios
docker compose -f ops/nagios/docker-compose.yml down
```

Nagios solo revisa dentro de la ventana `whereigo-operacion` (ver `ops/nagios/config/00-timeperiods.cfg`). Fuera de ella no genera tráfico, para no gastar las 750 horas gratis al mes de Render.

**Modo local** (plan B de la demo, o para practicar): vigila el stack de `docker compose up -d` por http y 24x7.

```bash
docker compose up -d                                   # stack completo (raíz del repo)
npm --prefix frontend run dev -- --host                # frontend accesible desde Nagios
cp ops/nagios/local.env.example ops/nagios/.env        # y completar clave y cuenta de monitoreo
docker compose -f ops/nagios/docker-compose.yml -f ops/nagios/docker-compose.local.yml up -d --build
bash ops/nagios/simulacro.sh postgres                  # simulacro: apagar, detectar, recuperar
```

Prometheus + Grafana en local: ver `ops/monitoring/docker-compose.local.yml` (Prometheus en `:9090`, Grafana en `:3030`).

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

`/health/ready` dice qué dependencia falló: `database` en auth-service; `model` y `rabbitmq` en ai-service.

- `database`: revisar que la base de Render no haya expirado (la gratuita vence a los **30 días** de creada). Restaurar desde el último `pg_dump`.
- `model`: ver [modelo-no-cargado](#modelo-no-cargado).
- `rabbitmq` (solo con `RABBITMQ_ENABLED=true`): el ai-service reintenta cada 5 s solo. Revisar que el broker esté arriba (`docker compose ps rabbitmq` en local). Mientras tanto el ETA sigue funcionando con la congestión por defecto.

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

## Respaldar y restaurar Postgres

La base gratis de Render **vence a los 30 días** de creada y se borra 14 días después. Antes de esa fecha hay que tener un respaldo.

**Respaldar** (la *External Database URL* está en Render → `whereigo-postgres` → Connect):

```bash
# Con Docker no hace falta instalar Postgres. La URL va entre comillas y nunca se sube al repo.
docker run --rm -v "$PWD:/backup" postgres:16-alpine \
  pg_dump "$RENDER_DATABASE_URL" --format=custom --no-owner --file=/backup/whereigo-$(date +%F).dump
```

**Restaurar** en una base nueva (otra base de Render, o la local del compose para probar):

```bash
# 1. En Render: crear la base nueva (o volver a aplicar el Blueprint) y copiar su External Database URL.
# 2. Restaurar el respaldo:
docker run --rm -v "$PWD:/backup" postgres:16-alpine \
  pg_restore --dbname="$NUEVA_DATABASE_URL" --no-owner --clean --if-exists /backup/whereigo-AAAA-MM-DD.dump
# 3. Si la base cambió: en Render, actualizar DATABASE_URL de whereigo-auth-service (el Blueprint lo hace solo
#    si la base es la del render.yaml) y redesplegar.
# 4. Verificar: /health/ready del auth-service debe dar database=up, y el login con una cuenta existente debe funcionar.
```

Probar la restauración en local antes de necesitarla:

```bash
docker compose up -d postgres
docker compose exec -T postgres pg_restore -U whereigo -d whereigo_auth --no-owner --clean --if-exists < whereigo-AAAA-MM-DD.dump
```

Guardar los `.dump` fuera del repo (nunca en git: tienen hashes de contraseñas y correos).

## Cuentas y administradores

| Plataforma | Qué hay ahí | Administra | Respaldo |
|---|---|---|---|
| GitHub ([Estebannh18/whereigo](https://github.com/Estebannh18/whereigo)) | Código, Actions, GHCR, Secrets del entorno `staging` | Juan Esteban Hernández (`@Estebannh18`) | Juan José Gamboa (colaborador) |
| Render | Postgres, gateway, auth-service, ai-service, deploy hooks | Juan Esteban Hernández (workspace del corte anterior) | Juan José Gamboa |
| Vercel | Frontend y previews por PR | Juan Esteban Hernández | Juan José Gamboa |
| Trello ([DevOps Whereigo?](https://trello.com/b/RJ80fDhn/devops-whereigo)) | Backlog por fase y sprints | Juan Esteban Hernández | Juan José Gamboa, Carlos Pineda |
| Telegram (bot de Nagios) | Alertas de operación | Quien creó el bot con BotFather | El otro integrante |

Si alguien pierde el acceso: el administrador lo vuelve a invitar. Si es el administrador quien pierde el acceso, lo recupera por el correo de la cuenta. **Nunca** se comparten contraseñas; cada uno entra con su cuenta.
