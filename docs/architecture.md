# Whereigo? — Decisiones de Arquitectura

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
| Route/Transport Service | `services/route-service` | — | ✅ Demo |
| Alert Service | `services/alert-service` | — | ✅ Fase B |
| AI/ETA Service | `services/ai-service` (Python/FastAPI) | — | ✅ Demo |

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

## 2.1 Contratos de API — Alert Service (Fase B)

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

## 2.2 Contratos de API — Traffic Service (Fase A)

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

### `routes` y `stops` (route-service, demo)

`routes` contiene las rutas de transporte y `stops` sus paraderos ordenados. Las
coordenadas se almacenan como `decimal` WGS84 para la demo de Bucaramanga; todavía
no se usa una geometría PostGIS ni un motor de red vial.

El `SeedModule` inserta, solo cuando `routes` está vacía, estas tres rutas con
paraderos de ejemplo: `Centro - UIS`, `Cabecera - Centro` y `Lagos - Centro`.

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

## 7. Contratos de API — Route Service

Base interna: `route-service` en el puerto `3004`. El frontend usa el Gateway
con el prefijo `/routes`.

| Método | Ruta pública vía Gateway | Auth | Descripción |
|---|---|---|---|
| GET | `/routes/route-search` | pública | Busca opciones de taxi directo y buses activos entre dos coordenadas |
| GET | `/routes` | admin | Lista rutas con paraderos |
| POST | `/routes` | admin | Crea una ruta y sus paraderos |
| GET | `/routes/:id` | admin | Consulta una ruta |
| PATCH | `/routes/:id` | admin | Actualiza una ruta y reemplaza sus paraderos |
| DELETE | `/routes/:id` | admin | Elimina una ruta |
| GET | `/stops/route/:routeId` | pública | Lista paraderos de una ruta |
| POST | `/stops/route/:routeId` | admin | Agrega un paradero |
| PATCH | `/stops/:id` | admin | Actualiza un paradero |
| DELETE | `/stops/:id` | admin | Elimina un paradero |

La búsqueda acepta `originLat`, `originLon`, `destinationLat`, `destinationLon`,
`preference` (`cheapest`, `fastest`, `fewest_transfers`) y `departureTime`.
Las coordenadas se convierten a número y se validan como latitud/longitud finitas.
El trazado vial se obtiene desde `ROUTING_SERVICE_URL` usando una respuesta
GeoJSON completa de OSRM (`overview=full`); si el router no responde, la opción
se omite y nunca se dibuja una línea recta artificial.

Para taxi, la demo aplica `$1.000 COP/km` sobre la distancia vial calculada, con
una tarifa mínima de `$9.100 COP`. El AI puede estimar ETA, pero no reemplaza
esta tarifa regulada.

Las fuentes candidatas para incorporar rutas reales de buses son el catálogo de
datos abiertos del **AMB** y los trazados oficiales de **Metrolínea/SITME**. Antes
de agregarlos al seed se debe confirmar vigencia, paraderos y sentido de cada
ruta; no se deben inventar recorridos a partir únicamente del nombre comercial.

## 8. AI/ETA Service

Base interna: `ai-service` en el puerto `8000`, expuesta por el Gateway bajo `/ai`.

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/ai/health` | pública | Estado y carga de modelos |
| POST | `/ai/predict` | pública | Predice ETA y tarifa para coordenadas y hora de salida |
| GET | `/ai/traffic-state` | pública | Estado de segmentos recibido desde RabbitMQ |

El primer arranque puede tardar porque entrena el modelo sintético si no existen
archivos en `app/models/`. La imagen tiene un healthcheck HTTP y espera RabbitMQ
saludable antes de iniciar.

## 9. Demo, favoritos y alcance actual

- Usuario admin demo: `admin@whereigo.dev` / `Admin123!`. Se puede cambiar con
  `DEMO_ADMIN_EMAIL` y `DEMO_ADMIN_PASSWORD`.
- El admin se crea solo si ese correo no existe; no sobrescribe usuarios existentes.
- Las rutas frecuentes se guardan actualmente en `localStorage` del navegador,
  con un máximo de 10; todavía no existe persistencia por usuario en backend.
- Las alertas activas se consultan cada cinco segundos y se muestran en el mapa y
  en el dashboard. Si una alerta está a menos de 750 m de la ruta seleccionada,
  se muestra un aviso y el botón de alternativa permite elegir otra opción ya
  calculada; todavía no se recalcula una topología evitando segmentos afectados.
- El buscador consulta alertas activas antes de pedir la geometría vial y solicita
  alternativas a OSRM. Las geometrías que pasan dentro de `0.25 km` de una alerta
  se descartan cuando existe otra alternativa; si el motor no ofrece una ruta
  segura, se muestra la ruta principal con una advertencia explícita.
- La búsqueda y el mapa están implementados para la demo; el cálculo de bus es
  heurístico y no representa todavía una red vial multimodal real.

## 10. Reparto de trabajo

`TODO`: definir qué integrante lleva qué microservicio/fase.
