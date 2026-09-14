// services/gateway/src/proxy/proxy.service.ts
import { HttpService } from '@nestjs/axios';
import { HttpException, Injectable } from '@nestjs/common';
import { AxiosError, Method } from 'axios';
import { firstValueFrom } from 'rxjs';

/**
 * Reenvía una petición HTTP a un microservicio interno preservando método,
 * cuerpo y el header Authorization (necesario para que el propio microservicio
 * revalide el JWT y aplique sus propias reglas de autorización).
 */
@Injectable()
export class ProxyService {
  constructor(private readonly httpService: HttpService) {}

  async forward<T = unknown>(params: {
    baseUrl: string;
    path: string;
    queryString?: string;
    method: Method;
    body?: unknown;
    authorizationHeader?: string;
  }): Promise<T> {
    const { baseUrl, path, queryString, method, body, authorizationHeader } = params;

    try {
      const response = await firstValueFrom(
        this.httpService.request<T>({
          // Reuse the encoded query received by the gateway. This avoids
          // dropping query params and preserves coordinate precision.
          url: `${baseUrl}${path}${queryString ? `?${queryString}` : ''}`,
          method,
          data: body,
          headers: authorizationHeader ? { Authorization: authorizationHeader } : undefined,
        }),
      );
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string | string[] }>;
      if (axiosError.response) {
        throw new HttpException(axiosError.response.data ?? 'Error en el microservicio.', axiosError.response.status);
      }
      // El microservicio no respondió (caído, timeout, DNS): se traduce a 502 en vez de colgar la petición.
      throw new HttpException('El servicio no está disponible en este momento.', 502);
    }
  }
}
