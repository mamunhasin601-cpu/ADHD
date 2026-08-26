import { apiClient } from '../api-client';
import type { AuthTokens, User } from '@focus/shared-types';

export interface OAuthProviderAvailability {
  yandex: boolean;
  vk: boolean;
  mailru: boolean;
}

export function parseOAuthProviderAvailability(value: unknown): OAuthProviderAvailability {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Invalid OAuth provider availability');
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.join(',') !== 'mailru,vk,yandex' ||
      typeof record.yandex !== 'boolean' ||
      typeof record.vk !== 'boolean' ||
      typeof record.mailru !== 'boolean') {
    throw new Error('Invalid OAuth provider availability');
  }
  return {
    yandex: record.yandex,
    vk: record.vk,
    mailru: record.mailru,
  };
}

export async function getOAuthProviderAvailability(): Promise<OAuthProviderAvailability> {
  const { data } = await apiClient.get<unknown>('/auth/oauth/providers');
  return parseOAuthProviderAvailability(data);
}

export interface LoginPayload {
  email?: string;
  phone?: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  timezone?: string;
}

export type VerificationChannel = 'EMAIL' | 'PHONE';

export interface VerifiedRegisterPayload extends RegisterPayload {
  emailVerificationToken?: string;
  phoneVerificationToken?: string;
}

export interface StartContactVerificationPayload {
  channel: VerificationChannel;
  destination: string;
}

export interface StartContactVerificationResponse {
  challengeId: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

export interface ConfirmContactVerificationPayload {
  challengeId: string;
  code: string;
}

export interface ConfirmContactVerificationResponse {
  verificationToken: string;
  expiresInSeconds: number;
}

export async function login(payload: LoginPayload): Promise<AuthTokens> {
  const { data } = await apiClient.post<AuthTokens>('/auth/login', payload);
  return data;
}

export async function register(payload: VerifiedRegisterPayload): Promise<AuthTokens> {
  const { data } = await apiClient.post<AuthTokens>('/auth/register', payload);
  return data;
}

export async function registerVerified(payload: VerifiedRegisterPayload): Promise<AuthTokens> {
  return register(payload);
}

export async function startContactVerification(
  payload: StartContactVerificationPayload,
): Promise<StartContactVerificationResponse> {
  const { data } = await apiClient.post<StartContactVerificationResponse>(
    '/auth/contact-verification/start',
    payload,
  );
  return data;
}

export async function confirmContactVerification(
  payload: ConfirmContactVerificationPayload,
): Promise<ConfirmContactVerificationResponse> {
  const { data } = await apiClient.post<ConfirmContactVerificationResponse>(
    '/auth/contact-verification/confirm',
    payload,
  );
  return data;
}

/** Сервер отдаёт пользователя без passwordHash (см. AuthController.getMe) */
export async function getMe(): Promise<User> {
  const { data } = await apiClient.get<User>('/auth/me');
  return data;
}
