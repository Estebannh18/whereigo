# docs/environments.md — Ambientes de Whereigo?

Qué es cada ambiente, cómo se llega a él y qué variables necesita. **Aquí nunca van valores secretos**: solo dónde vive cada uno.

## Ambientes

| Ambiente | Para qué | Cómo se despliega | URL | Datos |
|---|---|---|---|---|
| **local** | Desarrollar y probar | `docker compose up -d` (o el devcontainer / Codespaces si Docker Desktop no arranca) | `localhost:5173` (frontend), `:3000` (gateway) | Postgres del compose, seed con admin demo, simulador de tráfico |
| **preview** | Revisar un PR antes de fusionarlo | Vercel crea un preview por PR (frontend) apuntando al backend de staging | URL que Vercel comenta en el PR | Los de staging |
| **staging** | Integración real en la nube | Push a `main` → CI en verde → `deploy.yml` llama los deploy hooks de Render | `https://whereigo-<servicio>.onrender.com` | Postgres gratis de Render (vence a los 30 días: ver backups) |
| **demo** | Sustentación | Tag `vX.Y.Z` con aprobación manual (pendiente: tarjeta "Versionado semántico") | Mismas URLs de staging | Los de staging |

## Variables por servicio y ambiente

`✔` = obligatoria, `–` = no aplica. La columna "Dónde se guarda" dice en qué plataforma vive el valor real.

### auth-service

| Variable | local | staging | Dónde se guarda |
|---|---|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` | ✔ | – | `services/auth-service/.env` |
| `DATABASE_URL` | – | ✔ | Render (lo inyecta el Blueprint desde la base) |
| `DB_SYNCHRONIZE` | `true` | `true` (deuda: migraciones) | `.env` / `render.yaml` |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | ✔ | ✔ (distintos a local) | `.env` / Render (`generateValue`) |
| `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | ✔ | ✔ | `.env` / `render.yaml` |
| `BCRYPT_SALT_ROUNDS` | ✔ | ✔ | `.env` / `render.yaml` |
| `DEMO_ADMIN_EMAIL`, `DEMO_ADMIN_PASSWORD` | opcional | ✔ | `.env` / Render (`sync: false`) |
| `METRICS_TOKEN` | opcional | ✔ | `.env` / Render; igual a `ops/monitoring/secrets/metrics_token` |

### ai-service

| Variable | local | staging | Dónde se guarda |
|---|---|---|---|
| `RABBITMQ_ENABLED` | `true` | `false` (sin broker en el plan gratis) | `.env` / `render.yaml` |
| `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USER`, `RABBITMQ_PASSWORD`, `RABBITMQ_EXCHANGE` | ✔ | – | `services/ai-service/.env` |
| `MODEL_VERSION` | opcional | ✔ | `.env` / `render.yaml` |
| `METRICS_TOKEN` | opcional | ✔ | `.env` / Render |
| `PYTHON_VERSION` | – | `3.11.9` | `render.yaml` |

### gateway

| Variable | local | staging | Dónde se guarda |
|---|---|---|---|
| `AUTH_SERVICE_URL`, `AI_SERVICE_URL`, … | ✔ (nombres del compose) | ✔ (URLs de Render) | `docker-compose.yml` / Render (`sync: false`) |
| `JWT_ACCESS_SECRET` | ✔ | ✔ (**el mismo** de auth-service) | `.env` / Render |
| `CORS_ORIGINS` | `http://localhost:5173` | dominio de Vercel | `.env` / Render |

### frontend

| Variable | local | preview / production | Dónde se guarda |
|---|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:3000` | URL del gateway en Render | `frontend/.env` / Vercel |

## CI/CD y operación

| Secreto o variable | Dónde se guarda | Lo usa |
|---|---|---|
| `RENDER_HOOK_AUTH`, `RENDER_HOOK_AI` | GitHub → Environment `staging` → Secrets | `.github/workflows/deploy.yml` |
| `AUTH_URL`, `AI_URL` | GitHub → Environment `staging` → Variables | Smoke test de `deploy.yml` |
| `GITHUB_TOKEN` | Automático | Publicar imágenes en GHCR |
| `NAGIOSADMIN_PASS`, `TELEGRAM_BOT_TOKEN`, `MONITOR_USER_*`, `RENDER_HOOK_*` | `ops/nagios/.env` (ignorado por git) | Nagios |
| `metrics_token`, `grafana_admin` | `ops/monitoring/secrets/` (ignorado por git) | Prometheus y Grafana |

Rotar cualquiera de estos valores: ver [runbook.md → Rotar secretos](runbook.md#rotar-secretos).
