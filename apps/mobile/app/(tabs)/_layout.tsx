import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { GlobalCaptureProvider, useGlobalCapture } from '../../components/GlobalCapture';
import { OrbitsNavigation } from '../../components/navigation/OrbitsNavigation';
import { useOverdueTasks } from '../../lib/api/tasks';
import { useAuthStore } from '../../stores/auth.store';
import { isValidIANATimezone } from '../../lib/timezone';
import {
  destinationForRuntimeRoute,
  runtimeRouteForDestination,
} from '../../lib/orbits-tabs';

function OrbitsTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { openGlobalCapture } = useGlobalCapture();
  const activeRoute = state.routes[state.index]?.name ?? 'today';
  const profileTimezone = useAuthStore((s) => s.user?.timezone);
  const timezoneValid = Boolean(profileTimezone && isValidIANATimezone(profileTimezone));
  const { data: recoveryData } = useOverdueTasks(new Date(), timezoneValid, timezoneValid ? profileTimezone : undefined);

  return (
    <OrbitsNavigation
      activeDestination={destinationForRuntimeRoute(activeRoute)}
      onSelect={(destination) => navigation.navigate(runtimeRouteForDestination(destination))}
      onAdd={openGlobalCapture}
      recoveryCount={timezoneValid ? (recoveryData?.tasks.length ?? 0) : 0}
      bottomInset={insets.bottom}
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
