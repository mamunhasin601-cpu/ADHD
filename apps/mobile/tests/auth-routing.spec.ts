import { resolveAuthRedirect } from '../lib/auth-routing';
import type { User } from '@focus/shared-types';

const user = (hasCompletedOnboarding: boolean): User => ({
  id: 'user-1',
  email: 'user@example.com',
  phone: null,
  timezone: 'Europe/Moscow',
    timeFormat: 'SYSTEM',
  hasCompletedOnboarding,
  plan: 'FREE',
  proExpiresAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
});

describe('resolveAuthRedirect', () => {
  it('waits for bootstrap before making a routing decision', () => {
    expect(
      resolveAuthRedirect({
        segments: ['(tabs)', 'today'],
        isLoading: true,
        isAuthenticated: false,
        user: null,
      }),
    ).toBeNull();
  });

  it.each([['(tabs)', 'today'], ['task-form']])(
    'protects %p when there is no session',
    (...segments) => {
      expect(
        resolveAuthRedirect({
          segments,
          isLoading: false,
          isAuthenticated: false,
          user: null,
        }),
      ).toBe('/login');
    },
  );

  it('keeps Login stable for an unauthenticated user', () => {
    expect(
      resolveAuthRedirect({
        segments: ['login'],
        isLoading: false,
        isAuthenticated: false,
        user: null,
      }),
    ).toBeNull();
  });

  it('routes a new authenticated user to Onboarding', () => {
    expect(
      resolveAuthRedirect({
        segments: ['login'],
        isLoading: false,
        isAuthenticated: true,
        user: user(false),
      }),
    ).toBe('/onboarding');
  });

  it('keeps an incomplete user on Onboarding without a loop', () => {
    expect(
      resolveAuthRedirect({
        segments: ['onboarding'],
        isLoading: false,
        isAuthenticated: true,
        user: user(false),
      }),
    ).toBeNull();
  });

  it('routes an existing authenticated user to Today', () => {
    expect(
      resolveAuthRedirect({
        segments: ['login'],
        isLoading: false,
        isAuthenticated: true,
        user: user(true),
      }),
    ).toBe('/(tabs)/today');
  });

  it('keeps an authenticated user on protected routes', () => {
    expect(
      resolveAuthRedirect({
        segments: ['task-form'],
        isLoading: false,
        isAuthenticated: true,
        user: user(true),
      }),
    ).toBeNull();
  });
});
