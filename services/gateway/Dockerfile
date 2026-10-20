# services/gateway/Dockerfile
# Mismo patrón multi-etapa de services/auth-service/Dockerfile.

# --- Etapa 1: compilar ---------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
# Una sola descarga de paquetes: se compila y se quitan las dependencias de desarrollo.
RUN npm run build && npm prune --omit=dev

# --- Etapa 2: ejecutar (solo dist/ y dependencias de producción) ---------------
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/health" || exit 1
CMD ["node", "dist/main.js"]
