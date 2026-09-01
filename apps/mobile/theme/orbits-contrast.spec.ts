import { contrastRatio, ORBITS_THEMES } from './orbits';

describe('actual Orbits Today small-text contrast pairs', () => {
  it.each(Object.keys(ORBITS_THEMES) as Array<keyof typeof ORBITS_THEMES>)(
    '%s theme production pairs meet 4.5:1',
    (name) => {
      const theme = ORBITS_THEMES[name];
      const productionPairs = {
        canvasPrimary: [theme.textPrimary, theme.background],
        canvasSecondary: [theme.textSecondary, theme.background],
        completion: [theme.completionPrimary, theme.completionSoft],
        todayReturn: [theme.activeSurfaceText, theme.activeSurface],
        error: [theme.errorPrimary, theme.errorSoft],
        current: [theme.activeSurfaceText, theme.activeSurface],
        retry: [theme.retryText, theme.brandPressed],
        notificationSecondary: [theme.activeSurfaceText, theme.activeSurface],
        nowEyebrow: [theme.activeBorder, theme.surfacePrimary],
        nowError: [theme.errorPrimary, theme.surfacePrimary],
        recoveryBanner: [theme.rewardPrimary, theme.rewardSoft],
        recoveryPrimary: [theme.textPrimary, theme.surfacePrimary],
        recoverySecondary: [theme.textSecondary, theme.surfacePrimary],
        recoveryAction: [theme.activeSurfaceText, theme.activeSurface],
      } as const;

      for (const [pairName, [foreground, background]] of Object.entries(productionPairs)) {
        expect({ pairName, ratio: contrastRatio(foreground, background) }).toEqual({
          pairName,
          ratio: expect.any(Number),
        });
        expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
});
