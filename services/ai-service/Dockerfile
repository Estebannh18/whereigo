# services/ai-service/Dockerfile
# Imagen del microservicio de IA (FastAPI + TinyMLP en NumPy), en dos etapas.
# Al arrancar carga los modelos de MODEL_PATH o, si no existen, los entrena y los guarda ahí.

# --- Etapa 1: instalar dependencias en un entorno virtual ----------------------
FROM python:3.11-slim AS build
ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY requirements.txt .
RUN pip install --default-timeout=1000 -r requirements.txt

# --- Etapa 2: ejecutar (solo el venv y el código, sin herramientas de build) ---
FROM python:3.11-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    MODEL_PATH=/app/app/models \
    # Cada worker carga su propio modelo y sus propias métricas: con más de 1,
    # /metrics y el MAE móvil muestran solo el worker que responde. Dejar en 1.
    UVICORN_WORKERS=1

WORKDIR /app
RUN useradd --create-home --uid 10001 appuser
COPY --from=build /opt/venv /opt/venv
COPY app ./app
# El usuario sin privilegios necesita escribir MODEL_PATH (modelos entrenados al arrancar).
RUN mkdir -p "$MODEL_PATH" && chown -R appuser:appuser "$MODEL_PATH"

USER appuser
EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=12 \
  CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.environ.get('PORT', '8000') + '/health', timeout=3)"

# Render inyecta PORT; en local se usa 8000.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers ${UVICORN_WORKERS}"]
