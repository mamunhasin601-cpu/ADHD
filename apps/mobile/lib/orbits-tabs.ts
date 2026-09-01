import type { OrbitsDestination } from '../components/navigation/OrbitsNavigation';

export type OrbitsRuntimeRoute = 'today' | 'plan' | 'progress' | 'settings';

export function destinationForRuntimeRoute(routeName: string): OrbitsDestination {
  if (routeName === 'plan' || routeName === 'progress') return routeName;
  if (routeName === 'settings') return 'profile';
  return 'today';
}

export function runtimeRouteForDestination(destination: OrbitsDestination): OrbitsRuntimeRoute {
  return destination === 'profile' ? 'settings' : destination;
}
