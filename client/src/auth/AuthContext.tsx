import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { loadStoredAuth, saveStoredAuth, clearStoredAuth } from '../lib/tokenStorage';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  tenantId: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (input: { email: string; password: string; tenantSubdomain?: string }) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = loadStoredAuth();
    if (!stored) {
      setIsLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => {
        setUser(res.data.user as AuthUser);
      })
      .catch(() => {
        clearStoredAuth();
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = useCallback(
    async (input: { email: string; password: string; tenantSubdomain?: string }): Promise<AuthUser> => {
      const res = await api.post('/auth/login', input);
      const { accessToken, refreshToken, user: loggedInUser } = res.data;
      saveStoredAuth({ accessToken, refreshToken });
      setUser(loggedInUser as AuthUser);
      return loggedInUser as AuthUser;
    },
    []
  );

  const logout = useCallback(() => {
    clearStoredAuth();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, isLoading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
