# docs/adr/0003-github-actions-render-vercel.md

# ADR-003: GitHub Actions para CI/CD, Render para el backend y Vercel para el frontend

- Estado: aceptada
- Fecha: 2026-09-01 (registrada el 2026-10-19)

## Contexto

El proyecto no tiene presupuesto: todo debe correr en planes gratuitos. Vercel no ejecuta procesos persistentes de NestJS ni Postgres, y el curso exige una herramienta por fase del ciclo de vida.

## Decisión

- **GitHub Actions** (`.github/workflows/ci.yml`): lint, pruebas, build y auditoría de dependencias en cada PR; en `main` publica las imágenes en **GHCR** después de escanearlas con **Trivy**.
- **Render** (`render.yaml`) para Postgres, gateway, auth-service y ai-service. `autoDeploy: false` en los dos microservicios del ciclo de vida: los despliega `.github/workflows/deploy.yml` solo cuando CI pasa en `main`, y luego hace un smoke test de `/health`.
- **Vercel** para el frontend (`frontend/vercel.json`), con despliegue automático y *Instant Rollback*.

## Consecuencias

- Render gratis duerme los servicios tras 15 min sin tráfico y da 750 h/mes por workspace. Nagios solo revisa dentro de la ventana `whereigo-operacion` (ADR-004).
- Los secretos (`RENDER_HOOK_AUTH`, `RENDER_HOOK_AI`) van en GitHub Secrets del entorno `staging`; las URLs (`AUTH_URL`, `AI_URL`) en Variables.
- Trivy bloquea solo hallazgos CRÍTICOS mientras siga la deuda de NestJS 12 (ADR-002).
