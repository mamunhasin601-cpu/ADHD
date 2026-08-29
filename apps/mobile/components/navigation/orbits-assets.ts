import type { ImageSourcePropType } from 'react-native';

export type OrbitsAssetKey = 'today' | 'plan' | 'add' | 'progress' | 'profile';

// Base files are intentional static Metro density roots; Metro selects @2x/@3x.
export const ORBITS_NAVIGATION_ASSETS: Readonly<Record<OrbitsAssetKey, ImageSourcePropType>> = {
  today: require('../../assets/orbits/navigation/orbits-today.png'),
  plan: require('../../assets/orbits/navigation/orbits-plan.png'),
  add: require('../../assets/orbits/navigation/orbits-add.png'),
  progress: require('../../assets/orbits/navigation/orbits-progress.png'),
  profile: require('../../assets/orbits/navigation/orbits-profile.png'),
};
