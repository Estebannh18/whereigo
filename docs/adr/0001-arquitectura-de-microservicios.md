# docs/adr/0001-arquitectura-de-microservicios.md

# ADR-001: Microservicios detrás de un API Gateway

- Estado: aceptada
- Fecha: 2026-09-01 (registrada el 2026-10-19 a partir de `docs/architecture.md`)

## Contexto

Whereigo? junta funciones muy distintas: cuentas y roles, tráfico en tiempo real, rutas de transporte, alertas y predicción de ETA/tarifa con IA. Cada una cambia a un ritmo diferente y algunas (la IA) se hacen mejor en otro lenguaje.

## Decisión

- Un microservicio por responsabilidad (`gateway`, `auth-service`, `traffic-service`, `route-service`, `alert-service`, `ai-service`), cada uno con su carpeta, su `package.json` o `requirements.txt` y su `Dockerfile`, dentro de un monorepo.
- El frontend solo habla con el **gateway**, que valida el JWT y reenvía a cada servicio. Nunca conoce las URLs internas.
- Los eventos de tráfico viajan por **RabbitMQ** (`traffic.events`) para no acoplar a los productores con los consumidores.
- Para el ciclo de vida del curso se llevan de punta a punta **dos** microservicios: `auth-service` (NestJS) y `ai-service` (FastAPI). Ver [docs/ciclo-de-vida.md](../ciclo-de-vida.md).

## Consecuencias

- Cada servicio se construye, prueba y despliega por separado: el CI solo trabaja sobre el que cambió.
- Más piezas que operar: por eso hacen falta Nagios (Operar) y Prometheus (Monitorear).
- Un servicio caído no tumba a los demás, pero sí la transacción que lo necesita (ver dependencias en `ops/nagios/config/50-incidentes.cfg`).
