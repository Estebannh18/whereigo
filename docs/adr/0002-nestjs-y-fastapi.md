# docs/adr/0002-nestjs-y-fastapi.md

# ADR-002: NestJS para los servicios de negocio y FastAPI para la IA

- Estado: aceptada
- Fecha: 2026-09-01 (registrada el 2026-10-19)

## Contexto

El equipo trabaja en TypeScript en el frontend (React + Vite) y necesita entrenar y servir un modelo de ETA/tarifa, cosa que el ecosistema de Python resuelve mejor.

## Decisión

- **NestJS 10 + TypeScript** para gateway, auth, traffic, route y alert: módulos, inyección de dependencias, validación de DTOs con `class-validator` y Swagger.
- **FastAPI + NumPy** para `ai-service`: un perceptrón multicapa (TinyMLP) que se entrena con datos sintéticos de Bucaramanga si no encuentra modelos guardados en `app/models/`.
- Herramientas por stack: **Jest + ESLint** en NestJS y **pytest + Ruff** en Python. Las dos corren en CI.

## Consecuencias

- Dos cadenas de herramientas para mantener (npm y pip), cada una con su auditoría de dependencias (`npm audit`, `pip-audit`).
- El TinyMLP es simple y no necesita dependencias pesadas, pero hoy su MAE de ETA ronda los 15 min. La prueba `tests/test_model_quality.py` y la alerta `WhereigoModeloDegradado` lo vigilan; mejorarlo queda pendiente.
- NestJS 10 arrastra vulnerabilidades altas (`multer`, `lodash`, `js-yaml`) que solo se corrigen migrando a NestJS 12.
