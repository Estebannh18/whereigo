# Whereigo? — Fase 1: Arquitectura Base y Autenticación

Sistema Inteligente de Gestión de Tráfico Urbano — ciudad piloto: Bucaramanga, Santander.

Monorepo: `frontend` (React + Vite + TS + Tailwind), `services/auth-service` y
`services/gateway` (NestJS + TypeScript). Decisiones de arquitectura completas en
[`docs/architecture.md`](./docs/architecture.md).

## Estructura

```
whereigo/
├── frontend/                  # React + Vite + TS + Tailwind
├── services/
│   ├── gateway/                # NestJS — único punto de entrada del frontend
│   └── auth-service/           # NestJS — registro, login, JWT, roles
├── gtfs-data/                  # GTFS de Bucaramanga (Fase 3) — ver README ahí
├── docs/
│   └── architecture.md         # Contratos de API, esquema de BD, eventos, decisiones
├── docker-compose.yml           # Desarrollo local con Docker
├── render.yaml                  # Despliegue del backend en Render
└── README.md
```

---

## Opción A — Desplegar en la nube (recomendado, sin instalar nada localmente)

Frontend → **Vercel**. Backend → **Render** (Vercel no corre procesos persistentes
de NestJS/Postgres; ver `Stack Tecnológico.docx`). Ambos tienen plan gratuito.

### A.1 — Subir el proyecto a GitHub

1. Crea un repositorio nuevo (vacío) en https://github.com/new — ej. `whereigo`.
2. En tu computador, dentro de la carpeta `whereigo` descomprimida:

```bash
git init
git add .
git commit -m "Fase 1: auth-service, gateway y frontend"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/whereigo.git
git push -u origin main
```

Si no tienes Git instalado: https://git-scm.com/download/win (instalador, siguiente-siguiente).
Si no tienes cuenta de GitHub, créala en https://github.com/signup (gratis).

### A.2 — Backend en Render

1. Entra a https://dashboard.render.com (crea cuenta gratis, puedes usar tu cuenta de GitHub).
2. **New +** → **Blueprint** → conecta tu repositorio `whereigo`.
3. Render detecta `render.yaml` y muestra un preview: 1 base de datos Postgres +
   2 servicios web (`whereigo-auth-service`, `whereigo-gateway`). Revisa y **Apply**.
4. Espera a que `whereigo-auth-service` termine de desplegar (barra de estado en verde).
   Copia su URL pública (arriba del dashboard de ese servicio, algo como
   `https://whereigo-auth-service.onrender.com`).
5. Ve al servicio `whereigo-gateway` → pestaña **Environment** → completa las
   variables que quedaron pendientes (Render las marca como "not set" por venir
   de `sync: false` en el blueprint):
   - `AUTH_SERVICE_URL` = la URL que copiaste en el paso anterior.
   - `JWT_ACCESS_SECRET` = copia el valor que Render generó automáticamente para
     `whereigo-auth-service` (pestaña Environment de ese servicio) — **debe ser
     idéntico** en ambos.
   - `CORS_ORIGINS` = déjalo pendiente por ahora, lo completas en el paso A.3.
6. Guarda — Render redespliega el gateway automáticamente.
7. Verifica: abre `https://TU-GATEWAY.onrender.com/health` en el navegador → debe
   responder `{"status":"ok","service":"gateway",...}`.

### A.3 — Frontend en Vercel

1. Entra a https://vercel.com (crea cuenta gratis con tu cuenta de GitHub).
2. **Add New** → **Project** → importa el mismo repositorio `whereigo`.
3. En **Root Directory**, selecciona `frontend` (importante: el proyecto de
   Vercel es la subcarpeta, no la raíz del repo).
4. Framework Preset: Vercel debería detectar **Vite** automáticamente.
5. En **Environment Variables**, agrega:
   - `VITE_API_BASE_URL` = la URL pública de tu gateway en Render (paso A.2.7),
     sin barra final.
6. **Deploy**. Al terminar, Vercel te da una URL pública, ej. `https://whereigo.vercel.app`.
7. Vuelve a Render → `whereigo-gateway` → Environment → completa `CORS_ORIGINS`
   con esa URL de Vercel → guarda (redespliega solo).

### A.4 — Probar todo junto

Abre la URL de Vercel en el navegador → Regístrate → Inicia sesión → deberías
llegar al dashboard con tu correo y rol. Si algo falla, revisa primero **Logs**
del servicio correspondiente en el dashboard de Render (dice exactamente qué error dio).

### Actualizar después de un cambio de código

```bash
git add .
git commit -m "descripción del cambio"
git push
```

Tanto Render como Vercel redespliegan automáticamente al detectar el push.

---

## Opción B — Desarrollo local

### Con Docker Desktop

```bash
cd whereigo
cp services/auth-service/.env.example services/auth-service/.env
cp services/gateway/.env.example services/gateway/.env
cp frontend/.env.example frontend/.env
# Edita ambos .env de services/*: pon el MISMO valor en JWT_ACCESS_SECRET

docker compose up --build
```

```bash
# en otra terminal
cd whereigo/frontend
npm install
npm run dev
```

Abre http://localhost:5173.

### Sin Docker (Postgres instalado nativo)

```bash
cd whereigo/services/auth-service
npm install
npm run start:dev
```

```bash
# en otra terminal
cd whereigo/services/gateway
npm install
npm run start:dev
```

```bash
# en otra terminal
cd whereigo/frontend
npm install
npm run dev
```

## Verificación rápida (curl)

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@whereigo.dev","password":"contraseñaSegura123"}'

curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@whereigo.dev","password":"contraseñaSegura123"}'

curl http://localhost:3000/auth/me -H "Authorization: Bearer <accessToken>"
```

Swagger interactivo de `auth-service`: http://localhost:3001/docs (local) o
`https://TU-AUTH-SERVICE.onrender.com/docs` (Render).

---

## Siguientes fases (ver `docs/architecture.md` y el plan de desarrollo)

- **Fase 2**: `traffic-service` + Traffic Data Simulator.
- **Fase 2.5**: integrar GTFS + OSM de Bucaramanga (`gtfs-data/`).
- **Fase 3**: `route-service` + OpenTripPlanner + OSRM + mapa MapLibre en el frontend.
- **Fase 4**: `ai-service` (Python/FastAPI) — tarifas (XGBoost), ETA (red neuronal).
- **Fase 5**: `alert-service` + eventos RabbitMQ.
