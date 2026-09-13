# GTFS — Bucaramanga (ciudad piloto)

## Decisión de diseño (documentada para el informe del proyecto)

Metrolínea (el operador de transporte masivo de Bucaramanga) no publica un feed
GTFS oficial ni tiene una fuente pública confiable — además atraviesa una crisis
operativa (2025-2026) con rutas inestables. Ante esta limitación real del entorno
piloto, se optó conscientemente por un **GTFS comunitario**:

- Fuente: [`github.com/ColombiaInfo/ColombiaGTFS`](https://github.com/ColombiaInfo/ColombiaGTFS),
  carpeta "Bucaramanga - MetroLinea".
- Cobertura: 30 rutas, 1,112 paradas, shapes completos.
- `calendar.txt` corregido manualmente (vigencia extendida a 2030 — el original
  tenía fechas de vigencia vencidas).

Esto **no es un parche improvisado**: es la mejor fuente de datos disponible para
demostrar la arquitectura de ruteo multimodal (Fase 3) en una ciudad real, dada la
ausencia de una fuente oficial viva.

## Pendiente antes de integrar a OpenTripPlanner (Fase 3)

- [ ] Correr el feed completo por el [gtfs-validator de MobilityData](https://github.com/MobilityData/gtfs-validator)
      y corregir cualquier error bloqueante que reporte.
- [ ] Definir el bounding box de OpenStreetMap del área piloto (para el extracto
      `.osm.pbf` que necesitan OTP y OSRM).

## Contenido de esta carpeta

Los archivos GTFS reales (`.txt` / `.zip`) van aquí, pero **no se versionan en git**
si pesan mucho — agrega la carpeta a `.gitignore` si el feed supera unos pocos MB,
y documenta en este archivo dónde obtener la copia actual (o usa Git LFS).
