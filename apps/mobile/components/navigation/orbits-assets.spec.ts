import { ORBITS_NAVIGATION_ASSETS } from './orbits-assets';

describe('Orbits navigation asset registry', () => {
  it('contains exactly five semantic base-density roots', () => {
    expect(Object.keys(ORBITS_NAVIGATION_ASSETS)).toEqual(['today', 'plan', 'add', 'progress', 'profile']);
    expect(ORBITS_NAVIGATION_ASSETS).toEqual({
      today: require('../../assets/orbits/navigation/orbits-today.png'),
      plan: require('../../assets/orbits/navigation/orbits-plan.png'),
      add: require('../../assets/orbits/navigation/orbits-add.png'),
      progress: require('../../assets/orbits/navigation/orbits-progress.png'),
      profile: require('../../assets/orbits/navigation/orbits-profile.png'),
    });
  });
});
