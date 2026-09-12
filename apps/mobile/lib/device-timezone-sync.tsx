import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import type { Task, User } from '@focus/shared-types';
import { apiClient } from './api-client';
import {
  getLocalOnlyMode,
  LOCAL_REMINDER_HORIZON_DAYS,
  reconcileLocalReminders,
} from './local-notifications';
import { isValidIANATimezone } from './timezone';
import { useAuthStore } from '../stores/auth.store';

export function getDeviceIANATimezone(): string | null {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return timezone && isValidIANATimezone(timezone) ? timezone : null;
}

async function reconcileTimezoneLocalReminders(
  guard: () => boolean,
): Promise<void> {
  if (!guard()) return;
  const now = new Date();
  const horizon = new Date(
    now.getTime() + LOCAL_REMINDER_HORIZON_DAYS * 24 * 60 * 60 * 1000,
  );
  const { data } = await apiClient.get<Task[]>('/tasks', {
    params: {
      scheduledFrom: now.toISOString(),
      scheduledTo: horizon.toISOString(),
      includeSubTasks: false,
    },
  });
  if (!guard()) return;
  await reconcileLocalReminders(data, getLocalOnlyMode(), guard);
}

/**
 * Keeps the authenticated account on the smartphone's current IANA zone.
 * Failures are intentionally non-fatal and are retried on the next foreground.
 */
export function DeviceTimezoneSync({
  resolveTimezone = getDeviceIANATimezone,
}: {
  resolveTimezone?: () => string | null;
} = {}) {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const sessionGeneration = useAuthStore((state) => state.sessionGeneration);
  const setUser = useAuthStore((state) => state.setUser);
  const queryClient = useQueryClient();
  const inFlightRef = useRef<string | null>(null);

  const sync = useCallback(async () => {
    if (!isAuthenticated || !user) return;
    const timezone = resolveTimezone();
    if (!timezone) return;
    if (user.timezone === timezone && user.timezoneSyncedAt) return;

    const operationKey = `${user.id}:${sessionGeneration}:${timezone}`;
    if (inFlightRef.current === operationKey) return;
    inFlightRef.current = operationKey;
    const previousTimezone = user.timezone;
    const guard = () => {
      const state = useAuthStore.getState();
      return state.isAuthenticated &&
        state.user?.id === user.id &&
        state.sessionGeneration === sessionGeneration;
    };

    try {
      const { data } = await apiClient.patch<User>('/users/me/timezone', { timezone });
      if (!guard()) return;
      setUser(data);
      await queryClient.invalidateQueries({ queryKey: ['tasks'] }).catch(() => undefined);
      if (!guard()) return;
      if (previousTimezone !== timezone) {
        await reconcileTimezoneLocalReminders(guard).catch(() => undefined);
      }
    } catch {
      // The current profile remains canonical until a later lifecycle retry.
    } finally {
      if (inFlightRef.current === operationKey) inFlightRef.current = null;
    }
  }, [isAuthenticated, queryClient, resolveTimezone, sessionGeneration, setUser, user]);

  useEffect(() => {
    void sync();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync();
    });
    return () => subscription.remove();
  }, [sync]);

  return null;
}
