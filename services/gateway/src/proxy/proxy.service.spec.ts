// services/gateway/src/proxy/proxy.service.spec.ts
import { HttpService } from '@nestjs/axios';
import { HttpException } from '@nestjs/common';
import { AxiosError, AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';
import { ProxyService } from './proxy.service';

describe('ProxyService', () => {
  let request: jest.Mock;
  let service: ProxyService;

  beforeEach(() => {
    request = jest.fn();
    service = new ProxyService({ request } as unknown as HttpService);
  });

  it('reenvía método, cuerpo, query y Authorization tal cual', async () => {
    request.mockReturnValue(of({ data: { eta_minutes: 17.8 } } as AxiosResponse));

    const data = await service.forward({
      baseUrl: 'http://ai-service:8000',
      path: '/predict',
      queryString: 'lat=7.1193&lon=-73.1227',
      method: 'POST',
      body: { origin_lat: 7.1193 },
      authorizationHeader: 'Bearer abc',
    });

    expect(data).toEqual({ eta_minutes: 17.8 });
    expect(request).toHaveBeenCalledWith({
      url: 'http://ai-service:8000/predict?lat=7.1193&lon=-73.1227',
      method: 'POST',
      data: { origin_lat: 7.1193 },
      headers: { Authorization: 'Bearer abc' },
    });
  });

  it('sin query ni token no agrega "?" ni headers', async () => {
    request.mockReturnValue(of({ data: {} } as AxiosResponse));
    await service.forward({ baseUrl: 'http://auth:3001', path: '/auth/login', method: 'POST', body: {} });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ url: 'http://auth:3001/auth/login', headers: undefined }));
  });

  it('propaga el código y el cuerpo de error del microservicio (p. ej. 401)', async () => {
    const error = new AxiosError('401');
    error.response = { status: 401, data: { message: 'Credenciales inválidas.' } } as AxiosResponse;
    request.mockReturnValue(throwError(() => error));

    const thrown = await service
      .forward({ baseUrl: 'http://auth:3001', path: '/auth/login', method: 'POST' })
      .catch((e: unknown) => e);

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(401);
    expect((thrown as HttpException).getResponse()).toEqual({ message: 'Credenciales inválidas.' });
  });

  it('si el microservicio no responde devuelve 502 en vez de colgarse', async () => {
    request.mockReturnValue(throwError(() => new AxiosError('connect ECONNREFUSED')));

    const thrown = await service
      .forward({ baseUrl: 'http://ai-service:8000', path: '/predict', method: 'POST' })
      .catch((e: unknown) => e);

    expect((thrown as HttpException).getStatus()).toBe(502);
  });
});
