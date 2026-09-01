import { destinationForRuntimeRoute, runtimeRouteForDestination } from '../lib/orbits-tabs';

describe('installed Orbits tab contract', () => {
  it('maps every approved destination to a real runtime route', () => {
    expect(runtimeRouteForDestination('today')).toBe('today');
    expect(runtimeRouteForDestination('plan')).toBe('plan');
    expect(runtimeRouteForDestination('progress')).toBe('progress');
    expect(runtimeRouteForDestination('profile')).toBe('settings');
  });

  it('keeps profile truthful and fails unknown routes safely to Today', () => {
    expect(destinationForRuntimeRoute('settings')).toBe('profile');
    expect(destinationForRuntimeRoute('inbox')).toBe('today');
    expect(destinationForRuntimeRoute('focus')).toBe('today');
  });
});
