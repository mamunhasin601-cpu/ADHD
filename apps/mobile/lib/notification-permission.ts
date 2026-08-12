/**
 * Notification permission state management (Task 0011B blocker 2).
 *
 * Problem solved: the previous implementation called requestPermissionsAsync()
 * automatically on every authenticated bootstrap. On iOS and Android, once the
 * user denies permission, the next call still goes through if canAskAgain=true,
 * resulting in a permission prompt loop.
 *
 * Solution:
 * - Persist whether we have already requested permission using expo-secure-store.
 * - On subsequent bootstraps, check the stored state. If 'denied', do NOT request
 *   again — show neutral actionable UI instead.
 * - Only request again after an explicit user action (e.g. the banner's retry path)
 *   or after the user has changed permissions in OS settings (refreshPermissionState).
 */

import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';

const PERM_KEY = 'focus:notif_permission_state';

export type NotifPermState = 'not-asked' | 'granted' | 'denied';

/**
 * Read the persisted permission state for this installation.
 * Returns 'not-asked' if nothing has been stored yet (fresh install).
 */
export async function getStoredPermissionState(): Promise<NotifPermState> {
  try {
    const val = await SecureStore.getItemAsync(PERM_KEY);
    if (val === 'granted' || val === 'denied') return val;
    return 'not-asked';
  } catch {
    return 'not-asked';
  }
}

/**
 * Persist the current permission state.
 * Storage failure is non-fatal; the app remains functional.
 */
export async function setStoredPermissionState(state: NotifPermState): Promise<void> {
  try {
    await SecureStore.setItemAsync(PERM_KEY, state);
  } catch {
    // SecureStore failure is non-fatal.
  }
}

/**
 * Request notification permission ONCE per installation.
 *
 * If the stored state is 'denied', does NOT call requestPermissionsAsync()
 * automatically — returns 'denied' immediately so the caller can show
 * actionable UI without looping.
 *
 * If stored state is 'not-asked', requests once and persists the result.
 * If stored state is 'granted', re-checks the OS and updates if revoked.
 *
 * @returns The resolved permission state.
 */
export async function requestNotificationPermissionOnce(): Promise<NotifPermState> {
  const stored = await getStoredPermissionState();

  // Already denied — do not ask again automatically. Show actionable UI instead.
  if (stored === 'denied') {
    return 'denied';
  }

  // Check current OS state (handles the case where the user granted via OS settings
  // after a prior denial, or where the app was granted on install).
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();

  if (status === 'granted') {
    await setStoredPermissionState('granted');
    return 'granted';
  }

  // Permanently denied by the OS — no dialog possible.
  if (!canAskAgain) {
    await setStoredPermissionState('denied');
    return 'denied';
  }

  // First time asking (stored is 'not-asked'): request permission from the OS.
  const { status: newStatus } = await Notifications.requestPermissionsAsync();
  const finalState: NotifPermState = newStatus === 'granted' ? 'granted' : 'denied';
  await setStoredPermissionState(finalState);
  return finalState;
}

/**
 * Re-check OS permission state after the user may have changed it in OS settings.
 * Called when the app resumes from background (AppState change to 'active').
 *
 * Updates and returns the new stored state. This is the "explicit OS-state change"
 * retry path: if the user enables notifications in OS settings, the next resume
 * will discover the new 'granted' state and proceed with push registration.
 */
export async function refreshPermissionState(): Promise<NotifPermState> {
  const { status } = await Notifications.getPermissionsAsync();
  const newState: NotifPermState = status === 'granted' ? 'granted' : 'denied';
  await setStoredPermissionState(newState);
  return newState;
}

/**
 * Open the OS app-level notification settings page.
 * This is the explicit user action that may lead to the user re-enabling
 * notifications, after which refreshPermissionState() will discover the change.
 */
export async function openNotificationSettings(): Promise<void> {
  try {
    await Linking.openURL('app-settings:');
  } catch {
    // Fallback: open generic settings (Android)
    try {
      await Linking.openSettings();
    } catch {
      // Cannot open settings — non-fatal.
    }
  }
}
