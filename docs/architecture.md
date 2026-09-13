# Whereigo? — Decisiones de Arquitectura (Fase 0)

Ciudad piloto: **Bucaramanga, Santander**. Este documento se actualiza en cada fase;
lo que ya está construido se documenta como hecho, lo pendiente queda marcado `TODO`.

---

## 1. Microservicios — nombres definitivos

| Servicio | Carpeta | Responsable | Estado |
|---|---|---|---|
| Gateway | `services/gateway` | — | ✅ Fase 1 |
| Auth Service | `services/auth-service` | — | ✅ Fase 1 |
| Traffic Service | `services/traffic-service` | — | ✅ Fase A |
| Traffic Simulator | `services/traffic-simulator` | — | ✅ Fase A |
| Route/Transport Service | `services/route-service` | — | ⏳ Fase 3 |
| Alert Service | `services/alert-service` | — | ✅ Fase B |
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

## 2.2 Contratos de API — Alert Service (Fase B)

Base: `services/alert-service` (interno, puerto 3003) — expuesto al frontend solo
a través del Gateway bajo el prefijo `/alerts`.

| Método | Ruta | Body | Respuesta | Auth |
|---|---|---|---|---|
| GET | `/health` | — | `{ status: "ok", service, timestamp }` | pública |
| GET | `/alerts` | query: `alertType`, `severity`, `isActive`, `limit`, `offset` | `{ data: Alert[], total }` | pública |
| GET | `/alerts/active` | — | `{ data: Alert[] }` | pública |
| GET | `/alerts/:id` | — | `Alert` | pública |
| PATCH | `/alerts/:id/resolve` | — | `Alert` | Bearer JWT (admin) |

---

## 2.1 Contratos de API — Traffic Service (Fase A)

Base: `services/traffic-service` (interno, puerto 3002) — expuesto al frontend solo
a través del Gateway bajo el prefijo `/traffic`.

| Método | Ruta | Body | Respuesta | Auth |
|---|---|---|---|---|
| GET | `/health` | — | `{ status: "ok", service, timestamp }` | pública |
| GET | `/traffic` | query: `limit`, `offset`, `segmentId` | `{ data: TrafficReading[], total }` | pública |
| GET | `/traffic/current` | query: `segmentId?` | `{ data: TrafficReading[] }` | pública |
| GET | `/traffic/:id` | — | `TrafficReading` | pública |
| POST | `/traffic/incident` | `CreateIncidentDto` | `TrafficReading` | Bearer JWT (admin) |
| GET | `/traffic/incidents/active` | — | `{ data: TrafficReading[] }` | pública |

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

### `traffic_readings` (traffic-service, Fase A)

Tabla de lecturas de tráfico sintéticas y reales. Usa coordenadas simples en esta
fase; en Fase 3 se evaluará migrar a tipos PostGIS (`geometry`) cuando se integren
segmentos reales de calles.

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid (PK) | |
| segment_id | varchar | identificador del segmento vial |
| latitude | decimal(10,8) | latitud WGS84 |
| longitude | decimal(11,8) | longitud WGS84 |
| speed_kmh | decimal(5,2) | velocidad promedio estimada |
| congestion_level | integer (0-100) | 0 = libre, 100 = colapsado |
| is_peak_hour | boolean | indica hora pico |
| is_rainy | boolean | condición climática simulada |
| has_incident | boolean | indica si hay incidente activo |
| incident_type | enum('accident','blockade','construction','other'), nullable | tipo de incidente |
| severity | enum('low','medium','high'), nullable | severidad del incidente |
| recorded_at | timestamp | momento al que corresponde la lectura |
| created_at / updated_at | timestamp | |

Índices recomendados: `segment_id`, `recorded_at`, `(latitude, longitude)`.

### `alerts` (alert-service, Fase B)

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid (PK) | |
| segment_id | varchar | segmento vial afectado |
| latitude | decimal(10,8) | latitud WGS84 |
| longitude | decimal(11,8) | longitud WGS84 |
| alert_type | enum('incident','route_affected') | tipo de alerta |
| message | text | mensaje legible para el usuario |
| severity | enum('low','medium','high') | severidad |
| is_active | boolean | default true |
| resolved_at | timestamp, nullable | fecha de resolución |
| payload | jsonb, nullable | evento original completo |
| created_at / updated_at | timestamp | |

`TODO`: esquema de `route-service` (rutas, paraderos con PostGIS) y rutas favoritas
— se cierra en Fase 3, antes de escribir el código (regla de oro del plan).

---

## 4. Eventos RabbitMQ

Exchange: `traffic.events` (tipo `topic`).

| Evento | Routing key | Publica | Consume | Acción |
|---|---|---|---|---|
| `TrafficUpdated` | `traffic.updated` | traffic-service | ai-service (ETA) | Actualiza variables para predicción de tiempo de viaje |
| `IncidentDetected` | `traffic.incident.detected` | traffic-service | alert-service | Genera alerta al usuario |
| `RouteAffected` | `traffic.route.affected` | traffic-service | route-service, alert-service | Marca segmento afectado y evita recalcular todo; notifica |

### Payloads definitivos (Fase A)

#### `TrafficUpdated`
```json
{
  "eventType": "TrafficUpdated",
  "segmentId": "seg-001",
  "latitude": 7.1186,
  "longitude": -73.1165,
  "speedKmh": 24.5,
  "congestionLevel": 65,
  "isPeakHour": true,
  "isRainy": false,
  "recordedAt": "2026-09-13T10:30:00.000Z",
  "emittedAt": "2026-09-13T10:30:01.000Z"
}
```

#### `IncidentDetected`
```json
{
  "eventType": "IncidentDetected",
  "segmentId": "seg-001",
  "latitude": 7.1186,
  "longitude": -73.1165,
  "incidentType": "accident",
  "severity": "high",
  "detectedAt": "2026-09-13T10:30:00.000Z",
  "emittedAt": "2026-09-13T10:30:01.000Z"
}
```

#### `RouteAffected`
```json
{
  "eventType": "RouteAffected",
  "segmentId": "seg-001",
  "latitude": 7.1186,
  "longitude": -73.1165,
  "congestionLevel": 65,
  "incidentType": "accident",
  "reason": "incident",
  "affectedAt": "2026-09-13T10:30:00.000Z",
  "emittedAt": "2026-09-13T10:30:01.000Z"
}
```

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
