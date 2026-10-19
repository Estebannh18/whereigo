# services/ai-service/Dockerfile
# Imagen del microservicio de IA (FastAPI + TinyMLP en NumPy).
# Al arrancar carga los modelos de app/models/ o, si no existen, los entrena.
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
RUN useradd --create-home --uid 10001 appuser

COPY requirements.txt .
RUN pip install --default-timeout=1000 --no-cache-dir -r requirements.txt

COPY app ./app
# El usuario sin privilegios necesita escribir app/models/ (modelos entrenados al arrancar).
RUN mkdir -p app/models && chown -R appuser:appuser app/models

USER appuser
EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=12 \
  CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.environ.get('PORT', '8000') + '/health', timeout=3)"

# Render inyecta PORT; en local se usa 8000.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
