import * as storage from '../lib/orbits-theme-storage';
import { ORBITS_THEME_SAVE_ERROR, resetOrbitsThemeStoreForTests, useOrbitsThemeStore } from '../stores/orbits-theme.store';

jest.mock('../lib/orbits-theme-storage');

describe('Orbits theme preference state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetOrbitsThemeStoreForTests();
  });

  it('hydrates once and activates a saved theme', async () => {
    (storage.loadOrbitsTheme as jest.Mock).mockResolvedValue('dark');
    await Promise.all([useOrbitsThemeStore.getState().bootstrap(), useOrbitsThemeStore.getState().bootstrap()]);
    expect(storage.loadOrbitsTheme).toHaveBeenCalledTimes(1);
    expect(useOrbitsThemeStore.getState()).toMatchObject({ themeName: 'dark', hydrated: true });
  });

  it('does not write the active value', async () => {
    await expect(useOrbitsThemeStore.getState().selectTheme('warm')).resolves.toBe(false);
    expect(storage.saveOrbitsTheme).not.toHaveBeenCalled();
  });

  it('accepts a selection only after persistence succeeds', async () => {
    let resolve!: () => void;
    (storage.saveOrbitsTheme as jest.Mock).mockReturnValue(new Promise<void>((done) => { resolve = done; }));
    const pending = useOrbitsThemeStore.getState().selectTheme('dark');
    expect(useOrbitsThemeStore.getState()).toMatchObject({ themeName: 'warm', saving: true });
    resolve();
    await expect(pending).resolves.toBe(true);
    expect(useOrbitsThemeStore.getState().themeName).toBe('dark');
  });

  it('preserves the previous theme and sanitizes a failed save', async () => {
    (storage.saveOrbitsTheme as jest.Mock).mockRejectedValue(new Error('raw storage details'));
    await expect(useOrbitsThemeStore.getState().selectTheme('dark')).resolves.toBe(false);
    expect(useOrbitsThemeStore.getState()).toMatchObject({ themeName: 'warm', saveError: ORBITS_THEME_SAVE_ERROR });
  });

  it('prevents concurrent writes', async () => {
    (storage.saveOrbitsTheme as jest.Mock).mockReturnValue(new Promise(() => {}));
    void useOrbitsThemeStore.getState().selectTheme('dark');
    await expect(useOrbitsThemeStore.getState().selectTheme('warm')).resolves.toBe(false);
    expect(storage.saveOrbitsTheme).toHaveBeenCalledTimes(1);
  });
});
