// services/route-service/src/route-search/route-search.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Route, RouteType } from '../routes/entities/route.entity';
import { Stop } from '../stops/entities/stop.entity';
import { RoutePreference } from './dto/route-search.dto';

export interface RouteOption {
  id: string;
  type: RouteType;
  name: string;
  estimatedFare: number;
  estimatedEtaMinutes: number;
  transfers: number;
  walkingDistanceKm: number;
  totalDistanceKm: number;
  path: Array<{ lat: number; lon: number; type: 'stop' | 'walk' | 'origin' | 'destination'; label?: string }>;
  instructions: string[];
  routeIds: string[];
}

@Injectable()
export class RouteSearchService {
  constructor(
    @InjectRepository(Route)
    private readonly routeRepository: Repository<Route>,
    @InjectRepository(Stop)
    private readonly stopRepository: Repository<Stop>,
  ) {}

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

    // Opción 1: taxi directo
    const directDistance = this.haversine(originLat, originLon, destinationLat, destinationLon);
    options.push({
      id: 'opt-taxi-direct',
      type: RouteType.TAXI,
      name: 'Taxi directo',
      estimatedFare: Math.round(4500 + directDistance * 2500),
      estimatedEtaMinutes: Math.round(directDistance * 3),
      transfers: 0,
      walkingDistanceKm: 0,
      totalDistanceKm: directDistance,
      path: [
        { lat: originLat, lon: originLon, type: 'origin', label: 'Origen' },
        { lat: destinationLat, lon: destinationLon, type: 'destination', label: 'Destino' },
      ],
      instructions: [
        `Toma un taxi desde tu ubicación hasta el destino.`,
        `Distancia aproximada: ${directDistance.toFixed(2)} km.`,
      ],
      routeIds: [],
    });

    // Opción 2: bus cercano
    const busOptions = this.buildBusOptions(
      routes.filter((r) => r.type === RouteType.BUS),
      originLat,
      originLon,
      destinationLat,
      destinationLon,
    );
    options.push(...busOptions);

    // Opción 3: combinado bus + taxi
    options.push({
      id: 'opt-mixed',
      type: RouteType.MIXED,
      name: 'Bus + Taxi',
      estimatedFare: Math.round(2500 + directDistance * 1500),
      estimatedEtaMinutes: Math.round(directDistance * 4),
      transfers: 1,
      walkingDistanceKm: directDistance * 0.1,
      totalDistanceKm: directDistance,
      path: [
        { lat: originLat, lon: originLon, type: 'origin', label: 'Origen' },
        { lat: (originLat + destinationLat) / 2, lon: (originLon + destinationLon) / 2, type: 'stop', label: 'Transbordo' },
        { lat: destinationLat, lon: destinationLon, type: 'destination', label: 'Destino' },
      ],
      instructions: [
        `Caminá hasta el paradero más cercano.`,
        `Tomá un bus hasta el punto de transbordo.`,
        `De allí tomá un taxi hasta tu destino.`,
      ],
      routeIds: [],
    });

    return this.sortByPreference(options, preference);
  }

  private buildBusOptions(
    routes: Route[],
    originLat: number,
    originLon: number,
    destinationLat: number,
    destinationLon: number,
  ): RouteOption[] {
    const results: RouteOption[] = [];

    for (const route of routes) {
      const stops = route.stops;
      if (stops.length < 2) continue;

      const originStop = this.findNearestStop(stops, originLat, originLon);
      const destinationStop = this.findNearestStop(stops, destinationLat, destinationLon);

      if (!originStop || !destinationStop) continue;
      if (originStop.stopOrder >= destinationStop.stopOrder) continue;

      const path: RouteOption['path'] = [
        { lat: originLat, lon: originLon, type: 'origin', label: 'Origen' },
        { lat: originStop.latitude, lon: originStop.longitude, type: 'walk', label: `Caminar al paradero ${originStop.name}` },
      ];

      const segmentStops = stops.slice(originStop.stopOrder, destinationStop.stopOrder + 1);
      for (const stop of segmentStops) {
        path.push({ lat: stop.latitude, lon: stop.longitude, type: 'stop', label: stop.name });
      }

      path.push({ lat: destinationLat, lon: destinationLon, type: 'destination', label: 'Destino' });

      const busDistance = this.pathDistance(path.map((p) => [p.lat, p.lon]));
      const walkingDistance = this.haversine(originLat, originLon, originStop.latitude, originStop.longitude)
        + this.haversine(destinationStop.latitude, destinationStop.longitude, destinationLat, destinationLon);

      results.push({
        id: `opt-bus-${route.id}`,
        type: RouteType.BUS,
        name: route.name,
        estimatedFare: Number(route.baseFare),
        estimatedEtaMinutes: Math.round(busDistance * 6), // ~10 km/h promedio en bus urbano
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
      });
    }

    return results;
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
