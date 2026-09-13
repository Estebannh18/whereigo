// frontend/src/lib/tokenStorage.ts

// NOTA DE SEGURIDAD: localStorage es accesible desde cualquier script que corra en la
// página (riesgo de robo de token vía XSS). Para producción, la alternativa recomendada
// es que el backend emita el refresh token como cookie httpOnly + Secure + SameSite,
// y el frontend solo mantenga el access token en memoria. Se usa localStorage aquí para
// simplificar el MVP de la Fase 1; migrar antes de exponer el sistema a usuarios reales.

const ACCESS_TOKEN_KEY = 'whereigo_access_token';
const REFRESH_TOKEN_KEY = 'whereigo_refresh_token';

export const tokenStorage = {
  getAccessToken: (): string | null => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: (): string | null => localStorage.getItem(REFRESH_TOKEN_KEY),
  setTokens: (accessToken: string, refreshToken: string): void => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  clear: (): void => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};
