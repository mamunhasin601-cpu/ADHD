import * as SecureStore from 'expo-secure-store';
import { loadOrbitsTheme, ORBITS_THEME_STORAGE_KEY, saveOrbitsTheme } from '../lib/orbits-theme-storage';

jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn() }));

describe('Orbits theme storage', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([null, 'blue', '', '{"theme":"dark"}'])('loads %p as warm', async (stored) => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(stored);
    await expect(loadOrbitsTheme()).resolves.toBe('warm');
  });

  it.each(['warm', 'gray', 'dark'] as const)('loads exact %s', async (stored) => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(stored);
    await expect(loadOrbitsTheme()).resolves.toBe(stored);
  });

  it('fails closed without logging raw read errors', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('raw secret error'));
    await expect(loadOrbitsTheme()).resolves.toBe('warm');
  });

  it('persists only the exact selected string under its dedicated key', async () => {
    await saveOrbitsTheme('dark');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(ORBITS_THEME_STORAGE_KEY, 'dark');
  });
});
