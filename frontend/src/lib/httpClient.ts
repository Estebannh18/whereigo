// frontend/src/lib/httpClient.ts
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { tokenStorage } from './tokenStorage';

// Cliente HTTP único: todo el frontend habla exclusivamente con el api-gateway,
// nunca directamente con un microservicio.
export const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

httpClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshInFlight: Promise<string> | null = null;

// Si el access token expiró (401), intenta renovarlo una sola vez con el refresh
// token antes de reintentar la petición original. Evita loops de refresh en paralelo.
httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
      throw error;
    }

    const refreshToken = tokenStorage.getRefreshToken();
    if (!refreshToken) {
      tokenStorage.clear();
      throw error;
    }

    originalRequest._retry = true;

    try {
      if (!refreshInFlight) {
        refreshInFlight = axios
          .post(`${import.meta.env.VITE_API_BASE_URL}/auth/refresh`, { refreshToken })
          .then((res) => {
            tokenStorage.setTokens(res.data.accessToken, res.data.refreshToken);
            return res.data.accessToken as string;
          })
          .finally(() => {
            refreshInFlight = null;
          });
      }

      const newAccessToken = await refreshInFlight;
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return httpClient(originalRequest);
    } catch (refreshError) {
      tokenStorage.clear();
      throw refreshError;
    }
  },
);
