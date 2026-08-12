import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, AppStateStatus, StyleSheet, View } from 'react-native';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../stores/auth.store';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiClient } from '../lib/api-client';
import {
  reconcileLocalReminders,
  setLocalOnlyMode,
  LOCAL_REMINDER_HORIZON_DAYS,
} from '../lib/local-notifications';
import {
  requestNotificationPermissionOnce,
  refreshPermissionState,
  type NotifPermState,
} from '../lib/notification-permission';
import { NotificationPermissionBanner } from '../components/NotificationPermissionBanner';
import { resolveAuthRedirect } from '../lib/auth-routing';

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

  // Permission state for showing the actionable banner when denied.
  // null = not yet determined (first bootstrap still running).
  const [notifPermState, setNotifPermState] = useState<NotifPermState | null>(null);

  // Guard to prevent overlapping registration/revocation calls when AppState
  // fires multiple rapid 'active' transitions.
  const isHandlingTransition = useRef(false);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

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

  // AppState listener: on every resume for an authenticated user, re-check OS
  // notification state without showing an automatic prompt (0011C fix).
  //
  // Handles both directions:
  //   denied → granted: re-run push registration and restore remote-primary.
  //   granted → revoked: switch to local-fallback and reconcile reminders.
  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      // Only act on foreground transitions when we have a known prior state.
      if (nextState !== 'active' || !user || notifPermState === null) return;

      // Acquire the transition guard SYNCHRONOUSLY, before the first await
      // (Task 0011E finding 1). Setting it after `await refreshPermissionState()`
      // left a window where two concurrent 'active' events both passed the check
      // and ran overlapping registration/reconciliation paths.
      if (isHandlingTransition.current) return;
      isHandlingTransition.current = true;

      try {
        const refreshed = await refreshPermissionState().catch(
          () => 'denied' as NotifPermState,
        );

        // No change — nothing to do.
        if (refreshed === notifPermState) return;

        setNotifPermState(refreshed);

        if (refreshed === 'granted' && notifPermState !== 'granted') {
          // denied → granted: user re-enabled notifications in OS settings.
          // Re-run registration to restore the remote-primary channel.
          await runPushRegistration(user.id, setNotifPermState);
        } else if (refreshed === 'denied' && notifPermState === 'granted') {
          // granted → revoked: user disabled notifications in OS settings.
          // NO channel is available (local notifications need the same OS
          // permission as push), so owned reminders are cancelled, not rescheduled.
          await handlePermissionRevoked();
        }
      } finally {
        isHandlingTransition.current = false;
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [notifPermState, user]);

  // Register device token and reconcile local reminders after successful auth.
  //
  // Shares the SAME transition guard as the AppState listener (audit defect 2).
  // Without it, an 'active' event landing while mount registration is still in
  // flight runs overlapping setLocalOnlyMode/reconcile paths — the identical race
  // fixed in 0011E, on the other entry point. Acquired synchronously, released
  // when registration settles.
  useEffect(() => {
    if (!user) return;
    if (isHandlingTransition.current) return;
    isHandlingTransition.current = true;
    void runPushRegistration(user.id, setNotifPermState).finally(() => {
      isHandlingTransition.current = false;
    });
  }, [user]);

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
      <View style={styles.rootContainer}>
        {notifPermState === 'denied' && (
          <NotificationPermissionBanner
            onSettingsOpened={() => {
              // Settings opened; AppState listener will pick up the change on resume.
            }}
          />
        )}
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
      </View>
    </QueryClientProvider>
  );
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
});

/**
 * Push registration and bootstrap reconciliation.
 * Called on first authenticated mount and when denied→granted transition is
 * detected on app resume.
 */
async function runPushRegistration(
  userId: string,
  setPermState: (s: NotifPermState) => void,
): Promise<void> {
  // requestNotificationPermissionOnce reads the stored state. If previously
  // denied, it returns 'denied' immediately without showing another prompt.
  const permState = await requestNotificationPermissionOnce().catch(
    () => 'denied' as NotifPermState,
  );
  setPermState(permState);

  if (permState !== 'granted') {
    return;
  }

  // ── Push token registration (remote-primary channel) ─────────────────
  let localOnly = true;
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      ...(Platform.OS !== 'web' ? {} : {}),
    });
    const token = tokenData.data;

    await apiClient.post('/notifications/devices', {
      token,
      platform: Platform.OS === 'ios' ? 'apns' : Platform.OS === 'android' ? 'fcm' : 'expo',
    });

    localOnly = false;
  } catch {
    localOnly = true;
  }

  setLocalOnlyMode(localOnly);

  // ── Bounded bootstrap reconciliation ─────────────────────────────────
  const now = new Date();
  const horizon = new Date(
    now.getTime() + LOCAL_REMINDER_HORIZON_DAYS * 24 * 60 * 60 * 1000,
  );

  try {
    const { data: tasks } = await apiClient.get('/tasks', {
      params: {
        includeSubTasks: false,
        scheduledFrom: now.toISOString(),
        scheduledTo: horizon.toISOString(),
      },
    });
    await reconcileLocalReminders(tasks, localOnly);
  } catch {
    // Reconciliation failure is non-fatal.
  }
}

/**
 * Called when OS permission transitions from granted → denied/revoked.
 *
 * Cancels every Focus-owned local reminder. Does NOT select "local fallback".
 *
 * Why (corrected after 0011E audit): expo-notifications LOCAL scheduling requires
 * the same OS permission as remote push. `scheduleNotificationAsync` still resolves
 * successfully after revocation — the notification simply never displays. So a
 * revoked permission kills BOTH channels, and rescheduling local reminders here
 * would only create silent phantom entries.
 *
 * This is distinct from the local-fallback case in ADR-009 D-7, which applies when
 * push REGISTRATION fails while permission is still granted — there local genuinely
 * works. The earlier implementation conflated the two.
 *
 * `localOnly=false` is set because neither flag value means "no channel available";
 * false is the one whose behavior (mutation hooks skip local scheduling) is correct
 * here. The neutral banner carries the user-facing state.
 */
async function handlePermissionRevoked(): Promise<void> {
  setLocalOnlyMode(false);

  try {
    // Empty task list + localOnly=false → cancels all Focus-owned reminders,
    // schedules nothing. The correct end state when no channel can deliver.
    await reconcileLocalReminders([], false);
  } catch {
    // Non-fatal; task CRUD is unaffected.
  }
}
