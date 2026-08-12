import type { User } from '@focus/shared-types';

export type AuthRedirect = '/login' | '/onboarding' | '/(tabs)/today' | null;

interface ResolveAuthRedirectInput {
  segments: readonly string[];
  isLoading: boolean;
  isAuthenticated: boolean;
  user: User | null;
}

const AUTH_ROUTES = new Set(['login', 'register', 'auth-provider-select']);

export function resolveAuthRedirect({
  segments,
  isLoading,
  isAuthenticated,
  user,
}: ResolveAuthRedirectInput): AuthRedirect {
  if (isLoading || (isAuthenticated && !user)) return null;

  const firstSegment = segments[0] ?? '';
  const isRoot = segments.length === 0 || firstSegment === 'index';
  const isAuthRoute = AUTH_ROUTES.has(firstSegment);
  const isOnboarding = firstSegment === 'onboarding';

  if (!isAuthenticated) {
    return isAuthRoute ? null : '/login';
  }

  if (!user?.hasCompletedOnboarding) {
    return isOnboarding ? null : '/onboarding';
  }

  if (isRoot || isAuthRoute || isOnboarding) {
    return '/(tabs)/today';
  }

  return null;
}
