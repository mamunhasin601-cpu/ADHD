import { apiClient } from '../api-client';
import type { AuthTokens, User } from '@focus/shared-types';

export interface LoginPayload {
  email?: string;
  phone?: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  timezone?: string;
}

export async function login(payload: LoginPayload): Promise<AuthTokens> {
  const { data } = await apiClient.post<AuthTokens>('/auth/login', payload);
  return data;
}

export async function register(payload: RegisterPayload): Promise<AuthTokens> {
  const { data } = await apiClient.post<AuthTokens>('/auth/register', payload);
  return data;
}

/** Сервер отдаёт пользователя без passwordHash (см. AuthController.getMe) */
export async function getMe(): Promise<User> {
  const { data } = await apiClient.get<User>('/auth/me');
  return data;
}
