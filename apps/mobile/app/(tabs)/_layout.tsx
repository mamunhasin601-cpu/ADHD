import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { GlobalCaptureProvider, useGlobalCapture } from '../../components/GlobalCapture';
import { OrbitsNavigation } from '../../components/navigation/OrbitsNavigation';
import {
  destinationForRuntimeRoute,
  runtimeRouteForDestination,
} from '../../lib/orbits-tabs';

function OrbitsTabBar({ state, navigation }: BottomTabBarProps) {
  const { openGlobalCapture } = useGlobalCapture();
  const activeRoute = state.routes[state.index]?.name ?? 'today';

  return (
    <OrbitsNavigation
      activeDestination={destinationForRuntimeRoute(activeRoute)}
      onSelect={(destination) => navigation.navigate(runtimeRouteForDestination(destination))}
      onAdd={openGlobalCapture}
    />
  );
}

export default function TabsLayout() {
  return (
    <GlobalCaptureProvider showFloatingAction={false}>
      <Tabs
        tabBar={(props) => <OrbitsTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="today" options={{ title: 'Сегодня' }} />
        <Tabs.Screen name="plan" options={{ title: 'План' }} />
        <Tabs.Screen name="progress" options={{ title: 'Успех' }} />
        <Tabs.Screen name="settings" options={{ title: 'Профиль' }} />
        <Tabs.Screen name="inbox" options={{ href: null }} />
        <Tabs.Screen name="focus" options={{ href: null }} />
      </Tabs>
    </GlobalCaptureProvider>
  );
}
