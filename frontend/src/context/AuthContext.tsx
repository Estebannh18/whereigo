// frontend/src/context/AuthContext.tsx
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { httpClient } from '../lib/httpClient';
import { tokenStorage } from '../lib/tokenStorage';

export type UserRole = 'user' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Al montar la app, si ya hay un access token guardado, se valida contra /auth/me
  // en vez de asumir que sigue siendo válido (pudo expirar mientras la pestaña estaba cerrada).
  useEffect(() => {
    const bootstrap = async () => {
      if (!tokenStorage.getAccessToken()) {
        setIsLoading(false);
        return;
      }
      try {
        const { data } = await httpClient.get<AuthUser>('/auth/me');
        setUser(data);
      } catch {
        tokenStorage.clear();
      } finally {
        setIsLoading(false);
      }
    };
    bootstrap();
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await httpClient.post('/auth/login', { email, password });
    tokenStorage.setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
  };

  const register = async (email: string, password: string) => {
    await httpClient.post('/auth/register', { email, password });
    // El registro no autentica automáticamente: se exige login explícito por separado.
  };

  const logout = () => {
    tokenStorage.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un <AuthProvider>.');
  }
  return context;
}
