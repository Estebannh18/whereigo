// services/route-service/src/seed/seed.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Route, RouteType } from '../routes/entities/route.entity';
import { Stop } from '../stops/entities/stop.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

const bucaramangaBusRoutes = [
  {
    name: 'Centro - UIS',
    type: RouteType.BUS,
    baseFare: 2800,
    perKmRate: 0,
    stops: [
      { name: 'Parque Santander', lat: 7.1193, lon: -73.1227 },
      { name: 'Calle 36 con 15', lat: 7.1245, lon: -73.1198 },
      { name: 'Estadio Alfonso López', lat: 7.1298, lon: -73.1172 },
      { name: 'Universidad Industrial de Santander', lat: 7.1384, lon: -73.1205 },
    ],
  },
  {
    name: 'Cabecera - Centro',
    type: RouteType.BUS,
    baseFare: 2600,
    perKmRate: 0,
    stops: [
      { name: 'Centro Comercial Cabecera', lat: 7.1124, lon: -73.1089 },
      { name: 'Carrera 27 con 48', lat: 7.1167, lon: -73.1134 },
      { name: 'Parque García Rovira', lat: 7.1211, lon: -73.1189 },
      { name: 'Plaza Satélite del Norte', lat: 7.1256, lon: -73.1245 },
    ],
  },
  {
    name: 'Lagos - Centro',
    type: RouteType.BUS,
    baseFare: 2700,
    perKmRate: 0,
    stops: [
      { name: 'Ciudadela Comfenalco', lat: 7.1045, lon: -73.1321 },
      { name: 'Calle 45 con 18', lat: 7.1112, lon: -73.1298 },
      { name: 'Catedral de la Sagrada Familia', lat: 7.1183, lon: -73.1234 },
      { name: 'Mercado Público', lat: 7.1229, lon: -73.1201 },
    ],
  },
];

@Module({
  imports: [TypeOrmModule.forFeature([Route, Stop])],
})
export class SeedModule implements OnModuleInit {
  constructor(
    @InjectRepository(Route)
    private readonly routeRepository: Repository<Route>,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.routeRepository.count();
    if (count > 0) {
      return;
    }

    for (const routeData of bucaramangaBusRoutes) {
      const route = this.routeRepository.create({
        name: routeData.name,
        type: routeData.type,
        baseFare: routeData.baseFare,
        perKmRate: routeData.perKmRate,
        stops: routeData.stops.map((stop, index) => ({
          name: stop.name,
          latitude: stop.lat,
          longitude: stop.lon,
          stopOrder: index,
        })),
      });
      await this.routeRepository.save(route);
    }
  }
}
