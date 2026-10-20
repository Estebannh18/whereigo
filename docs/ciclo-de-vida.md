# docs/ciclo-de-vida.md — Ciclo de vida del software en Whereigo?

Se llevan **dos microservicios** por todas las fases como proyectos de software (no solo como contenedores):

| Microservicio | Stack | Qué hace |
|---|---|---|
| `services/auth-service` | NestJS 10 + TypeORM + Postgres | Registro, login, JWT (access/refresh) y roles |
| `services/ai-service` | FastAPI + NumPy (TinyMLP) | Predicción de ETA y tarifa, calidad del modelo |

## Herramienta por fase

| Fase | Herramienta principal | Apoyo | Evidencia en el repo |
|---|---|---|---|
| Planificar | **Trello** | ADRs, estrategia de ambientes | [Tablero](https://trello.com/b/RJ80fDhn/devops-whereigo), [docs/adr/](adr/), [docs/environments.md](environments.md) |
| Código | **Git + GitHub** | VS Code + devcontainer, Husky + lint-staged + gitleaks, plantillas de PR/issues, CODEOWNERS, .editorconfig | [.devcontainer/](../.devcontainer/devcontainer.json), [.husky/pre-commit](../.husky/pre-commit), [.lintstagedrc.mjs](../.lintstagedrc.mjs), [.github/](../.github/) |
| Construir | **Nest CLI / pip** | Docker multi-etapa | `npm run build`, `services/*/Dockerfile` |
| Probar | **Jest** (auth) y **pytest** (ai) | ESLint, Ruff | `services/auth-service/src/**/*.spec.ts`, `services/ai-service/tests/`, `ops/nagios/tests/` |
| Liberar | **GitHub Actions** | GHCR + Trivy, gitleaks, `npm audit`, `pip-audit`, Dependabot | [.github/workflows/ci.yml](../.github/workflows/ci.yml), [.github/dependabot.yml](../.github/dependabot.yml) |
| Desplegar | **Render** (deploy hooks) | Vercel para el frontend, smoke test de `/health` | [.github/workflows/deploy.yml](../.github/workflows/deploy.yml), [render.yaml](../render.yaml) |
| Operar | **Nagios Core 4.5** | Telegram, redeploy automático, runbook | [ops/nagios/](../ops/nagios/), [docs/runbook.md](runbook.md), [ADR-004](adr/0004-nagios-para-operar.md) |
| Monitorear | **Prometheus** | Grafana (dashboard), reglas de alerta | [ops/monitoring/](../ops/monitoring/) |

### Planificar: Trello

- Tablero (público): https://trello.com/b/RJ80fDhn/devops-whereigo
- Una lista por fase del ciclo + flujo En progreso → En revisión (PR abierto) → Hecho. Cada tarjeta tiene su checklist; la Definition of Done está en la tarjeta "[S1] Definition of Done común" y en la [plantilla de PR](../.github/pull_request_template.md).

> **Pendiente del equipo:** guardar 2–3 capturas en `docs/img/trello-*.png` (backlog, sprint en curso, tarjeta terminada).

## Qué expone cada microservicio para el ciclo de vida

| Endpoint | auth-service | ai-service | Lo usa |
|---|---|---|---|
| `GET /health` | proceso vivo | proceso vivo + `model_loaded` + `model_version` | Render, Docker, smoke test, Nagios |
| `GET /health/ready` | Postgres (`SELECT 1`), formato terminus | modelo cargado + RabbitMQ (si `RABBITMQ_ENABLED`), formato terminus | Nagios |
| `GET /metrics` (Bearer `METRICS_TOKEN`) | `http_requests_total`, `http_request_duration_seconds` | `whereigo_predictions_total`, `whereigo_prediction_latency_seconds`, `whereigo_model_mae_rolling` | Prometheus |
| `POST /feedback` | — | valor real de un viaje → MAE móvil (drift) | Prometheus / alerta de modelo |

## Cómo demostrar cada fase

```bash
# Probar (local, sin Docker)
cd services/auth-service && npm ci && npm run lint && npm test -- --coverage && npm run build
cd services/ai-service && pip install -r requirements-dev.txt && ruff check . && pytest -q

# Operar: validar la configuración de Nagios como en CI
docker build -t whereigo-nagios ops/nagios
docker run --rm --env-file ops/nagios/ci.env --entrypoint sh whereigo-nagios -c 'sed -i "s|^exec /usr/local/bin/start_nagios|exit 0|" /usr/local/bin/whereigo-entrypoint && whereigo-entrypoint'

# Monitorear: Prometheus (localhost:9090) y Grafana (localhost:3001)
mkdir -p ops/monitoring/secrets
# metrics_token = mismo valor que METRICS_TOKEN en Render; grafana_admin = clave del admin de Grafana
cp ops/monitoring/targets/whereigo.yml.example ops/monitoring/targets/whereigo.yml
docker compose -f ops/monitoring/docker-compose.yml up -d
```

Activar los hooks de git (una vez por clon): `npm install` en la raíz. El hook necesita `gitleaks` y `ruff` instalados (vienen en el devcontainer).

## Configuración en GitHub y Render

- **GitHub → Settings → Environments → `staging`**: Secrets `RENDER_HOOK_AUTH` y `RENDER_HOOK_AI`. Variables `AUTH_URL` y `AI_URL` (URLs públicas de Render, sin barra final).
- **Render**: `METRICS_TOKEN` en auth-service y ai-service; `AI_SERVICE_URL` en el gateway.
- **Nagios** (`ops/nagios/.env`): crear antes una cuenta de monitoreo con rol `user` (`POST /auth/register`) y poner sus datos en `MONITOR_USER_EMAIL` y `MONITOR_USER_PASSWORD`.

## Deuda conocida

- **NestJS 10 → 12**: quedan 4 vulnerabilidades altas en dependencias de producción de auth-service (`multer`, `lodash`, `js-yaml`, vía `@nestjs/platform-express` y `@nestjs/swagger`). Mientras tanto, CI y Trivy bloquean solo las críticas.
- **Calidad del modelo**: el TinyMLP da ~15 min de MAE en ETA (la línea base ingenua es peor, pero el objetivo original era 5). El umbral de la alerta y de la prueba está en 20 para detectar si empeora.
- **Usuario admin demo**: si `DEMO_ADMIN_PASSWORD` no está definido en Render, el seed crea `admin@whereigo.dev` con la clave por defecto. Definirla antes de la demo.
- Los otros servicios (gateway, traffic, route, alert) todavía no tienen lint ni pruebas: entran a CI cuando las tengan.
