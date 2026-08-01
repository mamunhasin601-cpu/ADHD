import axios from 'axios';
import type { AuthTokens } from '@focus/shared-types';

// В dev-режиме: ваш локальный IP или ngrok-адрес
// На реальном устройстве localhost не работает — нужен IP машины в сети
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3000'; // 10.0.2.2 — Android Emulator host

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

/** Установить access-токен в заголовки всех запросов */
export function setAuthToken(token: string | null) {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
  }
}

/** Интерцептор для автоматического обновления токена при 401 */
apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const axiosError = error as { response?: { status: number }; config?: { _retry?: boolean } & Record<string, unknown> };
    const originalRequest = axiosError.config;
    if (axiosError.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const { useAuthStore } = await import('../stores/auth.store');
        const refreshToken = useAuthStore.getState().refreshToken;
        if (!refreshToken) throw new Error('Нет refresh-токена');
        const { data } = await axios.post<AuthTokens>(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });
        useAuthStore.getState().setTokens(data);
        setAuthToken(data.accessToken);
        if (originalRequest.headers) {
          (originalRequest.headers as Record<string, string>)['Authorization'] = `Bearer ${data.accessToken}`;
        }
        return apiClient(originalRequest);
      } catch {
        const { useAuthStore } = await import('../stores/auth.store');
        useAuthStore.getState().logout();
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);