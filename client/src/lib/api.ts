import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { loadStoredAuth, saveStoredAuth, clearStoredAuth } from './tokenStorage';

export const api = axios.create({
  baseURL: '/api/v1',
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const stored = loadStoredAuth();
  if (stored?.accessToken) {
    config.headers.set('Authorization', `Bearer ${stored.accessToken}`);
  }
  return config;
});

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const stored = loadStoredAuth();
  if (!stored?.refreshToken) return null;
  try {
    const res = await axios.post('/api/v1/auth/refresh', { refreshToken: stored.refreshToken });
    const { accessToken, refreshToken } = res.data as { accessToken: string; refreshToken: string };
    saveStoredAuth({ accessToken, refreshToken });
    return accessToken;
  } catch {
    clearStoredAuth();
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = refreshAccessToken().finally(() => {
          isRefreshing = false;
        });
      }
      const newToken = await refreshPromise;
      if (newToken) {
        originalRequest.headers = originalRequest.headers ?? ({} as InternalAxiosRequestConfig['headers']);
        originalRequest.headers.set('Authorization', `Bearer ${newToken}`);
        return api(originalRequest);
      }
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
