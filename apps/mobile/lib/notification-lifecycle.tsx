import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { apiClient } from './api-client';
import { LOCAL_REMINDER_HORIZON_DAYS, reconcileLocalReminders, setLocalOnlyMode } from './local-notifications';
import {
  deferNotificationInvitation,
  getInvitationDisposition,
  inspectNotificationPermission,
  openNotificationSettings,
  refreshPermissionState,
  requestNotificationPermissionExplicitly,
  type NotificationInvitationDisposition,
  type NotifPermState,
} from './notification-permission';

type Lifecycle = {
  permission: NotifPermState | null;
  invitation: NotificationInvitationDisposition | null;
  busy: boolean;
  error: string | null;
  requestPermission: () => void;
  deferInvitation: () => void;
  openSettings: () => void;
};

const Context = createContext<Lifecycle | null>(null);

export function useNotificationLifecycle(): Lifecycle {
  const value = useContext(Context);
  if (!value) throw new Error('NotificationLifecycleProvider is missing');
  return value;
}

export function NotificationLifecycleProvider({ userId, children }: { userId?: string; children: React.ReactNode }) {
  const [permission, setPermission] = useState<NotifPermState | null>(null);
  const [invitation, setInvitation] = useState<NotificationInvitationDisposition | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const operation = useRef(0);
  const permissionRef = useRef(permission);
  permissionRef.current = permission;

  const registerAndReconcile = useCallback(async (id: string) => {
    let localOnly = true;
    try {
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      await apiClient.post('/notifications/devices', {
        token,
        platform: Platform.OS === 'ios' ? 'apns' : Platform.OS === 'android' ? 'fcm' : 'expo',
      });
      localOnly = false;
    } catch {
      localOnly = true;
    }
    setLocalOnlyMode(localOnly);
    const now = new Date();
    const horizon = new Date(now.getTime() + LOCAL_REMINDER_HORIZON_DAYS * 86400000);
    try {
      const { data } = await apiClient.get('/tasks', { params: { includeSubTasks: false, scheduledFrom: now.toISOString(), scheduledTo: horizon.toISOString() } });
      await reconcileLocalReminders(data, localOnly);
    } catch { /* non-blocking */ }
  }, []);

  const run = useCallback(async (kind: 'bootstrap' | 'explicit' | 'resume') => {
    if (!userId || operation.current) return;
    const generation = Date.now() + Math.random();
    operation.current = generation;
    if (kind === 'explicit' && mounted.current) { setBusy(true); setError(null); }
    try {
      const previous = permissionRef.current;
      const next = kind === 'bootstrap' || (kind === 'resume' && previous === 'not-asked')
        ? await inspectNotificationPermission()
        : kind === 'explicit'
          ? await requestNotificationPermissionExplicitly()
          : await refreshPermissionState();
      if (!mounted.current || operation.current !== generation) return;
      permissionRef.current = next;
      setPermission(next);
      if (next === 'granted' && previous !== 'granted') await registerAndReconcile(userId);
      if (next === 'denied' && previous === 'granted') {
        setLocalOnlyMode(false);
        await reconcileLocalReminders([], false).catch(() => undefined);
      }
    } catch {
      if (mounted.current && operation.current === generation) setError('Не удалось настроить напоминания. Попробуйте ещё раз.');
    } finally {
      if (mounted.current && operation.current === generation) {
        operation.current = 0;
        setBusy(false);
      }
    }
  }, [registerAndReconcile, userId]);

  useEffect(() => {
    mounted.current = true;
    void getInvitationDisposition().then((value) => { if (mounted.current) setInvitation(value); });
    void run('bootstrap');
    return () => { mounted.current = false; operation.current = 0; };
  }, [run]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') void run('resume'); });
    return () => sub.remove();
  }, [run]);

  const deferInvitation = useCallback(() => {
    setInvitation('deferred');
    void deferNotificationInvitation();
  }, []);

  return <Context.Provider value={{ permission, invitation, busy, error, requestPermission: () => void run('explicit'), deferInvitation, openSettings: () => void openNotificationSettings() }}>{children}</Context.Provider>;
}
