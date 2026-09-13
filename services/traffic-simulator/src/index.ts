// services/traffic-simulator/src/index.ts
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const TRAFFIC_SERVICE_URL = process.env.TRAFFIC_SERVICE_URL ?? 'http://localhost:3002';
const INTERVAL_MS = Number(process.env.SIMULATOR_INTERVAL_MS ?? 5000);
const RAIN_PROBABILITY = Number(process.env.RAIN_PROBABILITY ?? 0.15);
const INCIDENT_PROBABILITY = Number(process.env.INCIDENT_PROBABILITY ?? 0.02);

const MORNING_PEAK_START = process.env.MORNING_PEAK_START ?? '06:30';
const MORNING_PEAK_END = process.env.MORNING_PEAK_END ?? '09:00';
const EVENING_PEAK_START = process.env.EVENING_PEAK_START ?? '17:00';
const EVENING_PEAK_END = process.env.EVENING_PEAK_END ?? '20:00';

// Segmentos viales de Bucaramanga usados para la simulación.
// Coordenadas aproximadas dentro del área urbana.
interface Segment {
  id: string;
  latitude: number;
  longitude: number;
  baseSpeedKmh: number; // velocidad base del segmento
  congestionProne: boolean; // más propenso a congestión en hora pico
}

const SEGMENTS: Segment[] = [
  { id: 'seg-carrera-15', latitude: 7.1186, longitude: -73.1165, baseSpeedKmh: 45, congestionProne: true },
  { id: 'seg-calle-36', latitude: 7.1223, longitude: -73.1198, baseSpeedKmh: 35, congestionProne: true },
  { id: 'seg-carrera-27', latitude: 7.1251, longitude: -73.1124, baseSpeedKmh: 50, congestionProne: false },
  { id: 'seg-calle-45', latitude: 7.1142, longitude: -73.1089, baseSpeedKmh: 40, congestionProne: true },
  { id: 'seg-carrera-33', latitude: 7.1205, longitude: -73.1241, baseSpeedKmh: 55, congestionProne: false },
  { id: 'seg-calle-56', latitude: 7.1098, longitude: -73.1156, baseSpeedKmh: 30, congestionProne: true },
  { id: 'seg-paralela', latitude: 7.1167, longitude: -73.1202, baseSpeedKmh: 60, congestionProne: false },
  { id: 'seg-velodromo', latitude: 7.1134, longitude: -73.1229, baseSpeedKmh: 40, congestionProne: true },
];

type IncidentType = 'accident' | 'blockade' | 'construction' | 'other';
type Severity = 'low' | 'medium' | 'high';

interface TrafficReadingPayload {
  segmentId: string;
  latitude: number;
  longitude: number;
  speedKmh: number;
  congestionLevel: number;
  isPeakHour: boolean;
  isRainy: boolean;
  hasIncident: boolean;
  incidentType?: IncidentType;
  severity?: Severity;
  recordedAt: string;
}

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomChoice<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function parseTime(timeStr: string): { hour: number; minute: number } {
  const [hour, minute] = timeStr.split(':').map(Number);
  return { hour, minute };
}

function isInTimeRange(now: Date, start: string, end: string): boolean {
  const startT = parseTime(start);
  const endT = parseTime(end);
  const startMinutes = startT.hour * 60 + startT.minute;
  const endMinutes = endT.hour * 60 + endT.minute;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
}

function isPeakHour(now: Date): boolean {
  return (
    isInTimeRange(now, MORNING_PEAK_START, MORNING_PEAK_END) ||
    isInTimeRange(now, EVENING_PEAK_START, EVENING_PEAK_END)
  );
}

function generateReading(segment: Segment, now: Date): TrafficReadingPayload {
  const peakHour = isPeakHour(now);
  const rainy = Math.random() < RAIN_PROBABILITY;
  const incident = Math.random() < INCIDENT_PROBABILITY;

  // Factores que reducen la velocidad.
  let speedFactor = 1;
  if (peakHour && segment.congestionProne) speedFactor -= 0.35;
  if (rainy) speedFactor -= 0.15;
  if (incident) speedFactor -= 0.5;
  speedFactor = Math.max(0.1, speedFactor);

  const speedKmh = Number((segment.baseSpeedKmh * speedFactor * randomBetween(0.9, 1.1)).toFixed(2));
  const congestionLevel = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        (1 - speedKmh / segment.baseSpeedKmh) * 80 + (rainy ? 10 : 0) + (peakHour && segment.congestionProne ? 15 : 0),
      ),
    ),
  );

  const reading: TrafficReadingPayload = {
    segmentId: segment.id,
    latitude: segment.latitude,
    longitude: segment.longitude,
    speedKmh,
    congestionLevel,
    isPeakHour: peakHour,
    isRainy: rainy,
    hasIncident: incident,
    recordedAt: now.toISOString(),
  };

  if (incident) {
    reading.incidentType = randomChoice<IncidentType>(['accident', 'blockade', 'construction', 'other']);
    reading.severity = randomChoice<Severity>(['low', 'medium', 'high']);
  }

  return reading;
}

async function sendReading(reading: TrafficReadingPayload): Promise<void> {
  try {
    await axios.post(`${TRAFFIC_SERVICE_URL}/traffic`, reading);
    console.log(`[${new Date().toISOString()}] Enviado ${reading.segmentId} - velocidad: ${reading.speedKmh} km/h, congestión: ${reading.congestionLevel}%${reading.hasIncident ? ' [INCIDENTE]' : ''}`);
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] Error enviando lectura ${reading.segmentId}:`, error.message);
  }
}

async function runCycle(): Promise<void> {
  const now = new Date();
  const readings = SEGMENTS.map((segment) => generateReading(segment, now));

  // Se envían secuencialmente para no saturar el servicio.
  for (const reading of readings) {
    await sendReading(reading);
  }
}

async function main(): Promise<void> {
  console.log('🚦 Whereigo? Traffic Simulator iniciado');
  console.log(`→ Traffic service: ${TRAFFIC_SERVICE_URL}`);
  console.log(`→ Intervalo: ${INTERVAL_MS}ms`);
  console.log(`→ Segmentos: ${SEGMENTS.length}`);

  // Ciclo inicial inmediato.
  await runCycle();

  setInterval(() => {
    runCycle().catch((err) => console.error('Error en ciclo del simulador:', err));
  }, INTERVAL_MS);
}

main().catch((err) => {
  console.error('Error fatal en el simulador:', err);
  process.exit(1);
});
