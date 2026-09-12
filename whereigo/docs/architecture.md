# Whereigo? — Decisiones de Arquitectura (Fase 0)

Ciudad piloto: **Bucaramanga, Santander**. Este documento se actualiza en cada fase;
lo que ya está construido se documenta como hecho, lo pendiente queda marcado `TODO`.

---

## 1. Microservicios — nombres definitivos

| Servicio | Carpeta | Responsable | Estado |
|---|---|---|---|
| Gateway | `services/gateway` | — | ✅ Fase 1 |
| Auth Service | `services/auth-service` | — | ✅ Fase 1 |
| Traffic Service | `services/traffic-service` | — | ⏳ Fase 2 |
| Route/Transport Service | `services/route-service` | — | ⏳ Fase 3 |
| Alert Service | `services/alert-service` | — | ⏳ Fase 5 |
| AI/ETA Service | `services/ai-service` (Python/FastAPI) | — | ⏳ Fase 4 |

`TODO`: asignar responsable de cada servicio entre los dos integrantes.

---

## 2. Contratos de API — Auth Service (ya implementado)

Base: `services/auth-service` (interno, puerto 3001) — expuesto al frontend solo
a través del Gateway bajo el mismo path.

| Método | Ruta | Body | Respuesta | Auth |
|---|---|---|---|---|
| POST | `/auth/register` | `{ email, password }` | `{ id, email, role }` | pública |
| POST | `/auth/login` | `{ email, password }` | `{ user: {id,email,role}, accessToken, refreshToken }` | pública |
| POST | `/auth/refresh` | `{ refreshToken }` | `{ accessToken, refreshToken }` | pública (valida el refresh token) |
| GET | `/auth/me` | — | `{ id, email, role }` | Bearer JWT |
| GET | `/health` | — | `{ status: "ok", service, timestamp }` | pública |

**Payload del JWT (access y refresh)**: `{ sub: userId, email, role }`, firmados con
secretos independientes (`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`).

`TODO` (Fase 3.3, motor de preferencias): agregar `PATCH /users/me/preference`.

---

## 3. Esquema de base de datos

### `users` (auth-service, ya implementado)

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid (PK) | |
| email | varchar, unique | |
| password_hash | varchar | bcrypt, nunca se serializa al cliente |
| role | enum('user','admin') | default 'user' |
| last_preference | enum('cost','time','transfers'), nullable | reservado para Fase 3.3 |
| created_at / updated_at | timestamp | |

`TODO`: esquema de `route-service` (rutas, paraderos con PostGIS), `traffic-service`
(lecturas de congestión) y `alert-service` (alertas, rutas favoritas) — se cierran en
sus respectivas fases, antes de escribir el código (regla de oro del plan).

---

## 4. Eventos RabbitMQ

Definidos en `Stack Tecnológico.docx`, payload exacto `TODO` (Fase 5):

| Evento | Publica | Consume | Payload (pendiente de definir) |
|---|---|---|---|
| `IncidentDetected` | traffic-service | alert-service | `TODO` |
| `TrafficUpdated` | traffic-service | ai-service (ETA) | `TODO` |
| `RouteAffected` | traffic-service | route-service, alert-service | `TODO` |

---

## 5. Datos GTFS

Ver `gtfs-data/README.md`. Resumen: GTFS comunitario de Bucaramanga
(`ColombiaInfo/ColombiaGTFS`), `calendar.txt` ya corregido. Pendiente: correr
[gtfs-validator](https://github.com/MobilityData/gtfs-validator) antes de integrarlo
en OpenTripPlanner (Fase 3).

---

## 6. Despliegue

- **Frontend** → Vercel (ver `README.md`, sección Despliegue).
- **Backend** (gateway + auth-service, y los que se agreguen) → Render, vía
  `render.yaml` en la raíz del repo (Blueprint — Postgres administrado incluido).
- **Desarrollo local** → `docker-compose.yml` (Postgres+PostGIS, Redis, RabbitMQ
  y los servicios de Node), o cada servicio suelto con `npm run start:dev` contra
  un Postgres nativo si Docker no está disponible en la máquina.

---

## 7. Reparto de trabajo

`TODO`: definir qué integrante lleva qué microservicio/fase.
