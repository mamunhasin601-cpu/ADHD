import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../stores/auth.store';
import * as Notifications from 'expo-notifications';
import { NotificationPermissionBanner } from '../components/NotificationPermissionBanner';
import { NotificationLifecycleProvider, useNotificationLifecycle } from '../lib/notification-lifecycle';
import { resolveAuthRedirect } from '../lib/auth-routing';
import { OrbitsThemeProvider } from '../theme/orbits';
import { useOrbitsThemeStore } from '../stores/orbits-theme.store';

// Настройка обработчика уведомлений
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export default function RootLayout() {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const bootstrapTheme = useOrbitsThemeStore((s) => s.bootstrap);
  const themeName = useOrbitsThemeStore((s) => s.themeName);
  const themeHydrated = useOrbitsThemeStore((s) => s.hydrated);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const router = useRouter();
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();
  const isNavigatorMounted = Boolean(rootNavigationState?.key);
  const routerRef = useRef(router);
  const isNavigatorMountedRef = useRef(isNavigatorMounted);
  const pendingAuthRedirectRef = useRef<string | null>(null);
  routerRef.current = router;
  isNavigatorMountedRef.current = isNavigatorMounted;

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    void bootstrapTheme();
  }, [bootstrapTheme]);

  // Notification-tap listener: routes generic task-reminder taps to Today.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as { type?: string };
        if (data?.type === 'task-reminder' && isNavigatorMountedRef.current) {
          try {
            routerRef.current.navigate('/(tabs)/today');
          } catch {
            // Navigation failure is non-fatal.
          }
        }
      },
    );
    return () => subscription.remove();
  }, []);

  const authRedirect = resolveAuthRedirect({
    segments,
    isLoading,
    isAuthenticated,
    user,
  });

  useEffect(() => {
    if (!isNavigatorMounted || !authRedirect) {
      if (!authRedirect) pendingAuthRedirectRef.current = null;
      return;
    }

    if (pendingAuthRedirectRef.current === authRedirect) return;
    pendingAuthRedirectRef.current = authRedirect;
    router.replace(authRedirect);
  }, [authRedirect, isNavigatorMounted, router]);

  const isAuthGateVisible =
    !isNavigatorMounted || isLoading || (isAuthenticated && !user) || authRedirect !== null;

  return (
    <QueryClientProvider client={queryClient}>
      <OrbitsThemeProvider theme={themeName}>
      <NotificationLifecycleProvider userId={user?.id}>
      <View style={styles.rootContainer}>
        <PermissionBanner authenticated={Boolean(user)} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="auth-provider-select" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="paywall" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="task-form"
            options={{
              presentation: 'modal',
              headerShown: true,
              title: 'Задача',
            }}
          />
        </Stack>
        {isAuthGateVisible && (
          <View style={styles.loadingContainer} testID="auth-bootstrap-loading">
            <ActivityIndicator color="#6B5BFC" />
          </View>
        )}
        {!themeHydrated && (
          <View style={styles.themeLoadingContainer} testID="theme-bootstrap-loading">
            <ActivityIndicator color="#6B5BFC" />
          </View>
        )}
      </View>
      </NotificationLifecycleProvider>
      </OrbitsThemeProvider>
    </QueryClientProvider>
  );
}

function PermissionBanner({ authenticated }: { authenticated: boolean }) {
  const { permission } = useNotificationLifecycle();
  return authenticated && permission === 'denied' ? <NotificationPermissionBanner onSettingsOpened={() => undefined} /> : null;
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    zIndex: 1,
  },
  themeLoadingContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FCF9F6',
    zIndex: 2,
  },
});
