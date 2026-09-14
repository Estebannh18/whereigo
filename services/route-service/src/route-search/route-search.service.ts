// services/route-service/src/route-search/route-search.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Route, RouteType } from '../routes/entities/route.entity';
import { Stop } from '../stops/entities/stop.entity';
import { RoutePreference } from './dto/route-search.dto';

type RoutePointType = 'stop' | 'walk' | 'origin' | 'destination' | 'transfer';
interface ActiveAlertPoint {
  latitude: number;
  longitude: number;
}

export interface RouteOption {
  id: string;
  type: RouteType;
  name: string;
  estimatedFare: number;
  estimatedEtaMinutes: number;
  transfers: number;
  walkingDistanceKm: number;
  totalDistanceKm: number;
  path: Array<{ lat: number; lon: number; type: RoutePointType; label?: string }>;
  instructions: string[];
  routeIds: string[];
  incidentWarning?: string;
}

@Injectable()
export class RouteSearchService {
  private readonly logger = new Logger(RouteSearchService.name);
  private readonly routingServiceUrl: string;
  private readonly alertServiceUrl: string;
  private readonly incidentAvoidanceRadiusKm: number;

  constructor(
    @InjectRepository(Route)
    private readonly routeRepository: Repository<Route>,
    @InjectRepository(Stop)
    private readonly stopRepository: Repository<Stop>,
    private readonly config: ConfigService,
  ) {
    this.routingServiceUrl = (
      this.config.get<string>('ROUTING_SERVICE_URL') ?? 'https://router.project-osrm.org'
    ).replace(/\/$/, '');
    this.alertServiceUrl = (
      this.config.get<string>('ALERT_SERVICE_URL') ?? 'http://alert-service:3003'
    ).replace(/\/$/, '');
    this.incidentAvoidanceRadiusKm = Number(this.config.get<string>('INCIDENT_AVOIDANCE_RADIUS_KM') ?? 0.25);
  }

  async search(
    originLat: number,
    originLon: number,
    destinationLat: number,
    destinationLon: number,
    preference: RoutePreference = RoutePreference.FASTEST,
  ): Promise<RouteOption[]> {
    const routes = await this.routeRepository.find({
      where: { active: true },
      relations: ['stops'],
    });

    for (const route of routes) {
      route.stops.sort((a, b) => a.stopOrder - b.stopOrder);
    }

    const options: RouteOption[] = [];
    const activeAlerts = await this.getActiveAlerts();

    // Todas las opciones deben usar una geometría vial. Si el router no
    // responde, se omite la opción en vez de dibujar una línea falsa.
    const directGeometry = await this.getRoadGeometry([
      [originLon, originLat],
      [destinationLon, destinationLat],
    ], activeAlerts);
    if (directGeometry) {
      options.push({
        id: 'opt-taxi-direct',
        type: RouteType.TAXI,
        name: 'Taxi directo',
        estimatedFare: Math.max(9100, Math.round(directGeometry.distanceKm * 1000)),
        estimatedEtaMinutes: Math.max(1, Math.round(directGeometry.durationMinutes)),
        transfers: 0,
        walkingDistanceKm: 0,
        totalDistanceKm: directGeometry.distanceKm,
        path: this.geometryToPath(directGeometry.coordinates, [
          { coordinate: [originLon, originLat], type: 'origin', label: 'Origen' },
          { coordinate: [destinationLon, destinationLat], type: 'destination', label: 'Destino' },
        ]),
        instructions: [
          `Toma un taxi desde tu ubicación hasta el destino.`,
          `Distancia aproximada: ${directGeometry.distanceKm.toFixed(2)} km por vía. Tarifa estimada: $${Math.max(9100, Math.round(directGeometry.distanceKm * 1000)).toLocaleString('es-CO')} COP.`,
        ],
        routeIds: [],
        incidentWarning: directGeometry.affectedByIncident
          ? 'No se encontró una alternativa vial libre de alertas activas.'
          : undefined,
      });
    }

    // Opción 2: bus cercano
    const busOptions = await this.buildBusOptions(
      routes.filter((r) => r.type === RouteType.BUS),
      originLat,
      originLon,
      destinationLat,
      destinationLon,
      activeAlerts,
    );
    options.push(...busOptions);

    return this.sortByPreference(options, preference);
  }

  private async buildBusOptions(
    routes: Route[],
    originLat: number,
    originLon: number,
    destinationLat: number,
    destinationLon: number,
    activeAlerts: ActiveAlertPoint[],
  ): Promise<RouteOption[]> {
    const results: RouteOption[] = [];

    for (const route of routes) {
      const stops = route.stops;
      if (stops.length < 2) continue;

      const originStop = this.findNearestStop(stops, originLat, originLon);
      const destinationStop = this.findNearestStop(stops, destinationLat, destinationLon);

      if (!originStop || !destinationStop) continue;
      if (originStop.stopOrder >= destinationStop.stopOrder) continue;

       const segmentStops = stops.slice(originStop.stopOrder, destinationStop.stopOrder + 1);
      const waypoints: [number, number][] = [
        [originLon, originLat],
        [originStop.longitude, originStop.latitude],
        ...segmentStops.map((stop) => [stop.longitude, stop.latitude] as [number, number]),
        [destinationStop.longitude, destinationStop.latitude],
        [destinationLon, destinationLat],
      ];
      const roadGeometry = await this.getRoadGeometry(waypoints, activeAlerts);
      if (!roadGeometry) continue;

      const path = this.geometryToPath(roadGeometry.coordinates, [
        { coordinate: [originLon, originLat], type: 'origin', label: 'Origen' },
        { coordinate: [originStop.longitude, originStop.latitude], type: 'walk', label: `Caminar al paradero ${originStop.name}` },
        ...segmentStops.map((stop) => ({
          coordinate: [stop.longitude, stop.latitude] as [number, number],
          type: 'stop' as const,
          label: stop.name,
        })),
        { coordinate: [destinationLon, destinationLat], type: 'destination', label: 'Destino' },
      ]);

      const busDistance = roadGeometry.distanceKm;
      const walkingDistance = this.haversine(originLat, originLon, originStop.latitude, originStop.longitude)
        + this.haversine(destinationStop.latitude, destinationStop.longitude, destinationLat, destinationLon);

      results.push({
        id: `opt-bus-${route.id}`,
        type: RouteType.BUS,
        name: route.name,
        estimatedFare: Number(route.baseFare),
         estimatedEtaMinutes: Math.max(1, Math.round(roadGeometry.durationMinutes)),
        transfers: 0,
        walkingDistanceKm: walkingDistance,
        totalDistanceKm: busDistance,
        path,
        instructions: [
          `Caminá ${walkingDistance.toFixed(2)} km hasta el paradero ${originStop.name}.`,
          `Tomá la ruta ${route.name} hasta ${destinationStop.name}.`,
          `Bajate en ${destinationStop.name} y caminá hasta tu destino.`,
        ],
        routeIds: [route.id],
        incidentWarning: roadGeometry.affectedByIncident
          ? 'Esta ruta pasa cerca de una alerta activa y no se encontró otra alternativa vial.'
          : undefined,
      });
    }

    return results;
  }

  private async getRoadGeometry(
    waypoints: [number, number][],
    activeAlerts: ActiveAlertPoint[],
  ): Promise<{
    coordinates: [number, number][];
    distanceKm: number;
    durationMinutes: number;
    affectedByIncident: boolean;
  } | null> {
    const coordinates = waypoints.map(([lon, lat]) => `${lon},${lat}`).join(';');
    const url = `${this.routingServiceUrl}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false&alternatives=true`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`routing service returned ${response.status}`);
      const data = (await response.json()) as {
        code?: string;
        routes?: Array<{
          distance: number;
          duration: number;
          geometry?: { coordinates: [number, number][] };
        }>;
      };
      const safeRoute = data.routes?.find((candidate) =>
        candidate.geometry?.coordinates?.length && !this.geometryHasActiveAlert(candidate.geometry.coordinates, activeAlerts),
      );
      const route = safeRoute ?? data.routes?.[0];
      if (data.code !== 'Ok' || !route?.geometry?.coordinates?.length) {
        throw new Error(activeAlerts.length ? 'all available routes are affected by active alerts' : 'routing service returned no geometry');
      }
      return {
        coordinates: route.geometry.coordinates,
        distanceKm: route.distance / 1000,
        durationMinutes: route.duration / 60,
        affectedByIncident: !safeRoute && activeAlerts.length > 0,
      };
    } catch (error) {
      this.logger.warn(`No se pudo obtener geometría vial: ${(error as Error).message}`);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async getActiveAlerts(): Promise<ActiveAlertPoint[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    try {
      const response = await fetch(`${this.alertServiceUrl}/alerts/active`, { signal: controller.signal });
      if (!response.ok) throw new Error(`alert service returned ${response.status}`);
      const payload = (await response.json()) as { data?: Array<{ latitude: number; longitude: number }> };
      return (payload.data ?? []).map((alert) => ({
        latitude: Number(alert.latitude),
        longitude: Number(alert.longitude),
      }));
    } catch (error) {
      this.logger.warn(`No se pudieron consultar alertas activas: ${(error as Error).message}`);
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }

  private geometryHasActiveAlert(
    coordinates: [number, number][],
    activeAlerts: ActiveAlertPoint[],
  ): boolean {
    return coordinates.some(([longitude, latitude]) =>
      activeAlerts.some((alert) =>
        this.haversine(latitude, longitude, alert.latitude, alert.longitude) <= this.incidentAvoidanceRadiusKm,
      ),
    );
  }

  private geometryToPath(
    coordinates: [number, number][],
    markers: Array<{ coordinate: [number, number]; type: RoutePointType; label: string }>,
  ): RouteOption['path'] {
    const markerIndexes = new Map<number, { type: RoutePointType; label: string }>();
    for (const marker of markers) {
      let nearestIndex = 0;
      let nearestDistance = Infinity;
      coordinates.forEach((coordinate, index) => {
        const distance = (coordinate[0] - marker.coordinate[0]) ** 2 + (coordinate[1] - marker.coordinate[1]) ** 2;
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });
      markerIndexes.set(nearestIndex, { type: marker.type, label: marker.label });
    }

    return coordinates.map(([lon, lat], index) => ({
      lon,
      lat,
      type: markerIndexes.get(index)?.type ?? 'walk',
      label: markerIndexes.get(index)?.label,
    }));
  }

  private findNearestStop(stops: Stop[], lat: number, lon: number): Stop | null {
    let nearest: Stop | null = null;
    let minDist = Infinity;
    for (const stop of stops) {
      const d = this.haversine(lat, lon, stop.latitude, stop.longitude);
      if (d < minDist) {
        minDist = d;
        nearest = stop;
      }
    }
    return nearest;
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private pathDistance(points: Array<[number, number]>): number {
    let d = 0;
    for (let i = 1; i < points.length; i++) {
      d += this.haversine(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
    }
    return d;
  }

  private sortByPreference(options: RouteOption[], preference: RoutePreference): RouteOption[] {
    const sorted = [...options];
    if (preference === RoutePreference.CHEAPEST) {
      sorted.sort((a, b) => a.estimatedFare - b.estimatedFare);
    } else if (preference === RoutePreference.FASTEST) {
      sorted.sort((a, b) => a.estimatedEtaMinutes - b.estimatedEtaMinutes);
    } else if (preference === RoutePreference.FEWEST_TRANSFERS) {
      sorted.sort((a, b) => a.transfers - b.transfers);
    }
    return sorted;
  }
}
