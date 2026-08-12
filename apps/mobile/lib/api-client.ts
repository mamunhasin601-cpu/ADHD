import axios, { type AxiosRequestConfig } from 'axios';
import type { AuthTokens } from '@focus/shared-types';

// В dev-режиме: ваш локальный IP или ngrok-адрес
// На реальном устройстве localhost не работает — нужен IP машины в сети
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3000'; // 10.0.2.2 — Android Emulator host

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

let currentTokens: AuthTokens | null = null;

/** Установить access-токен в заголовки всех запросов */
export function setAuthToken(token: string | null) {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
  }
}

export function setAuthTokens(tokens: AuthTokens | null) {
  currentTokens = tokens;
  setAuthToken(tokens?.accessToken ?? null);
}

export function getAuthTokens(): AuthTokens | null {
  return currentTokens;
}

type RetryableRequestConfig = AxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<string> | null = null;
let logoutPromise: Promise<void> | null = null;

// Resolve lazily to avoid a Metro cycle: auth.store imports token helpers from
// this module, while refresh/logout need the store actions.
function getAuthStore() {
  return require('../stores/auth.store').useAuthStore as typeof import('../stores/auth.store').useAuthStore;
}

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = currentTokens?.refreshToken;
    if (!refreshToken) throw new Error('Нет refresh-токена');

    const { data } = await axios.post<AuthTokens>(`${API_BASE_URL}/auth/refresh`, {
      refreshToken,
    });
    await getAuthStore().getState().setTokens(data);
    return data.accessToken;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

async function logoutOnce(): Promise<void> {
  if (!logoutPromise) {
    logoutPromise = Promise.resolve(getAuthStore().getState().logout())
      .finally(() => {
        logoutPromise = null;
      });
  }
  return logoutPromise;
}

/** Интерцептор для автоматического обновления токена при 401 */
apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const axiosError = error as { response?: { status: number }; config?: RetryableRequestConfig };
    const originalRequest = axiosError.config;
    if (axiosError.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const accessToken = await refreshAccessToken();
        if (originalRequest.headers) {
          (originalRequest.headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
        } else {
          originalRequest.headers = { Authorization: `Bearer ${accessToken}` };
        }
        return apiClient(originalRequest);
      } catch {
        await logoutOnce();
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);
