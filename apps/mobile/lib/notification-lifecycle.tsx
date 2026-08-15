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

type Operation = { generation: number; owner: string };
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
  const owner = useRef(userId);
  owner.current = userId;
  const generation = useRef(0);
  const operation = useRef<Operation | null>(null);
  const permissionRef = useRef(permission);
  permissionRef.current = permission;
  const registeredOwner = useRef<string | null>(null);
  const invitationRef = useRef(invitation);
  invitationRef.current = invitation;
  const hydrationGeneration = useRef(0);

  const isCurrent = useCallback((owned: Operation) =>
    mounted.current && owner.current === owned.owner &&
    operation.current?.generation === owned.generation &&
    operation.current.owner === owned.owner, []);

  const registerAndReconcile = useCallback(async (owned: Operation): Promise<boolean> => {
    let localOnly = true;
    try {
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      if (!isCurrent(owned)) return false;
      await apiClient.post('/notifications/devices', {
        token,
        platform: Platform.OS === 'ios' ? 'apns' : Platform.OS === 'android' ? 'fcm' : 'expo',
      });
      if (!isCurrent(owned)) return false;
      localOnly = false;
    } catch {
      if (!isCurrent(owned)) return false;
      localOnly = true;
    }

    if (!isCurrent(owned)) return false;
    setLocalOnlyMode(localOnly);
    const now = new Date();
    const horizon = new Date(now.getTime() + LOCAL_REMINDER_HORIZON_DAYS * 86400000);
    try {
      const { data } = await apiClient.get('/tasks', {
        params: {
          includeSubTasks: false,
          scheduledFrom: now.toISOString(),
          scheduledTo: horizon.toISOString(),
        },
      });
      if (!isCurrent(owned)) return false;
      await reconcileLocalReminders(data, localOnly, () => isCurrent(owned));
    } catch {
      // Registration and task behavior remain usable when reconciliation fails.
    }
    return isCurrent(owned);
  }, [isCurrent]);

  const run = useCallback(async (kind: 'bootstrap' | 'explicit' | 'resume') => {
    const currentOwner = owner.current;
    if (!currentOwner || operation.current) return;
    const owned = { generation: ++generation.current, owner: currentOwner };
    operation.current = owned;
    if (kind === 'explicit' && mounted.current) {
      setBusy(true);
      setError(null);
    }
    try {
      const previous = permissionRef.current;
      const next = kind === 'bootstrap' || (kind === 'resume' && (previous === null || previous === 'not-asked'))
        ? await inspectNotificationPermission()
        : kind === 'explicit'
          ? await requestNotificationPermissionExplicitly()
          : await refreshPermissionState();
      if (!isCurrent(owned)) return;
      permissionRef.current = next;
      setPermission(next);
      setError(null);

      if (next === 'granted' && registeredOwner.current !== owned.owner) {
        if (await registerAndReconcile(owned)) registeredOwner.current = owned.owner;
      } else if (next === 'denied' && previous === 'granted') {
        registeredOwner.current = null;
        if (!isCurrent(owned)) return;
        setLocalOnlyMode(false);
        if (!isCurrent(owned)) return;
        await reconcileLocalReminders([], false, () => isCurrent(owned)).catch(() => undefined);
      }
    } catch {
      if (isCurrent(owned)) setError('Не удалось настроить напоминания. Попробуйте ещё раз.');
    } finally {
      if (isCurrent(owned)) {
        operation.current = null;
        setBusy(false);
      }
    }
  }, [isCurrent, registerAndReconcile]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      operation.current = null;
    };
  }, []);

  useEffect(() => {
    const ownedHydration = ++hydrationGeneration.current;
    void getInvitationDisposition().then((value) => {
      if (mounted.current && hydrationGeneration.current === ownedHydration && invitationRef.current !== 'deferred') {
        invitationRef.current = value;
        setInvitation(value);
      }
    });
    return () => { hydrationGeneration.current += 1; };
  }, []);

  useEffect(() => {
    if (!userId) {
      generation.current += 1;
      operation.current = null;
      setBusy(false);
      setError(null);
      return;
    }
    void run('bootstrap');
    return () => {
      generation.current += 1;
      operation.current = null;
    };
  }, [run, userId]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void run('resume');
    });
    return () => sub.remove();
  }, [run]);

  const deferInvitation = useCallback(() => {
    hydrationGeneration.current += 1;
    invitationRef.current = 'deferred';
    setInvitation('deferred');
    void deferNotificationInvitation();
  }, []);

  return (
    <Context.Provider value={{
      permission,
      invitation,
      busy,
      error,
      requestPermission: () => void run('explicit'),
      deferInvitation,
      openSettings: () => void openNotificationSettings(),
    }}>
      {children}
    </Context.Provider>
  );
}
