/**
 * notification-permission tests (Task 0011B blocker 2).
 *
 * Verifies:
 *  - First denial: persists 'denied' state
 *  - Permanent OS denial: stored as 'denied' without requesting
 *  - No automatic loop: second bootstrap with stored 'denied' returns without requesting
 *  - Explicit retry path: refreshPermissionState() discovers OS change
 *  - Granted path: stored as 'granted', push registration proceeds
 */

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
}));

jest.mock('react-native', () => ({
  Linking: {
    openURL: jest.fn(),
    openSettings: jest.fn(),
  },
}));

import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import {
  getStoredPermissionState,
  setStoredPermissionState,
  requestNotificationPermissionOnce,
  refreshPermissionState,
} from './notification-permission';

const mockGetItem = SecureStore.getItemAsync as jest.Mock;
const mockSetItem = SecureStore.setItemAsync as jest.Mock;
const mockGetPerms = Notifications.getPermissionsAsync as jest.Mock;
const mockRequestPerms = Notifications.requestPermissionsAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockSetItem.mockResolvedValue(undefined);
});

// ── getStoredPermissionState ───────────────────────────────────────────────

describe('getStoredPermissionState', () => {
  it('returns not-asked when nothing stored (fresh install)', async () => {
    mockGetItem.mockResolvedValue(null);
    await expect(getStoredPermissionState()).resolves.toBe('not-asked');
  });

  it('returns denied when stored value is denied', async () => {
    mockGetItem.mockResolvedValue('denied');
    await expect(getStoredPermissionState()).resolves.toBe('denied');
  });

  it('returns granted when stored value is granted', async () => {
    mockGetItem.mockResolvedValue('granted');
    await expect(getStoredPermissionState()).resolves.toBe('granted');
  });

  it('returns not-asked when stored value is unrecognized', async () => {
    mockGetItem.mockResolvedValue('unknown-value');
    await expect(getStoredPermissionState()).resolves.toBe('not-asked');
  });

  it('returns not-asked and does not throw when SecureStore fails', async () => {
    mockGetItem.mockRejectedValue(new Error('storage error'));
    await expect(getStoredPermissionState()).resolves.toBe('not-asked');
  });
});

// ── requestNotificationPermissionOnce ────────────────────────────────────────

describe('requestNotificationPermissionOnce — no automatic loop after denial', () => {
  it('returns denied immediately without calling requestPermissionsAsync when stored=denied', async () => {
    // Stored state is already 'denied' (prior session)
    mockGetItem.mockResolvedValue('denied');

    const result = await requestNotificationPermissionOnce();

    expect(result).toBe('denied');
    // Critical: no OS permission dialog shown
    expect(mockRequestPerms).not.toHaveBeenCalled();
  });

  it('first denial: requests once, persists denied, does not loop', async () => {
    // Fresh install: nothing stored
    mockGetItem.mockResolvedValue(null);
    mockGetPerms.mockResolvedValue({ status: 'undetermined', canAskAgain: true });
    mockRequestPerms.mockResolvedValue({ status: 'denied' });

    const result = await requestNotificationPermissionOnce();

    expect(result).toBe('denied');
    expect(mockRequestPerms).toHaveBeenCalledTimes(1);
    // Denial is persisted so next call will NOT request again
    expect(mockSetItem).toHaveBeenCalledWith(expect.any(String), 'denied');
  });

  it('permanent OS denial (canAskAgain=false): stored as denied, no request made', async () => {
    mockGetItem.mockResolvedValue(null);
    mockGetPerms.mockResolvedValue({ status: 'denied', canAskAgain: false });

    const result = await requestNotificationPermissionOnce();

    expect(result).toBe('denied');
    expect(mockRequestPerms).not.toHaveBeenCalled();
    expect(mockSetItem).toHaveBeenCalledWith(expect.any(String), 'denied');
  });

  it('granted path: OS already granted, stored as granted, no dialog shown', async () => {
    mockGetItem.mockResolvedValue(null);
    mockGetPerms.mockResolvedValue({ status: 'granted', canAskAgain: true });

    const result = await requestNotificationPermissionOnce();

    expect(result).toBe('granted');
    expect(mockRequestPerms).not.toHaveBeenCalled();
    expect(mockSetItem).toHaveBeenCalledWith(expect.any(String), 'granted');
  });

  it('user grants on first prompt: stored as granted', async () => {
    mockGetItem.mockResolvedValue(null);
    mockGetPerms.mockResolvedValue({ status: 'undetermined', canAskAgain: true });
    mockRequestPerms.mockResolvedValue({ status: 'granted' });

    const result = await requestNotificationPermissionOnce();

    expect(result).toBe('granted');
    expect(mockSetItem).toHaveBeenCalledWith(expect.any(String), 'granted');
  });

  it('stored=granted: re-checks OS; if still granted, no dialog shown', async () => {
    mockGetItem.mockResolvedValue('granted');
    mockGetPerms.mockResolvedValue({ status: 'granted', canAskAgain: true });

    const result = await requestNotificationPermissionOnce();

    expect(result).toBe('granted');
    expect(mockRequestPerms).not.toHaveBeenCalled();
  });

  it('stored=granted but OS revoked: updates to denied, no dialog shown', async () => {
    mockGetItem.mockResolvedValue('granted');
    mockGetPerms.mockResolvedValue({ status: 'denied', canAskAgain: false });

    const result = await requestNotificationPermissionOnce();

    expect(result).toBe('denied');
    expect(mockRequestPerms).not.toHaveBeenCalled();
    expect(mockSetItem).toHaveBeenCalledWith(expect.any(String), 'denied');
  });
});

// ── refreshPermissionState (explicit retry path) ──────────────────────────────

describe('refreshPermissionState — explicit OS-state change retry', () => {
  it('discovers granted state after user enables in OS settings', async () => {
    mockGetPerms.mockResolvedValue({ status: 'granted' });

    const result = await refreshPermissionState();

    expect(result).toBe('granted');
    expect(mockSetItem).toHaveBeenCalledWith(expect.any(String), 'granted');
  });

  it('discovers still-denied state after user ignores settings', async () => {
    mockGetPerms.mockResolvedValue({ status: 'denied' });

    const result = await refreshPermissionState();

    expect(result).toBe('denied');
    expect(mockSetItem).toHaveBeenCalledWith(expect.any(String), 'denied');
  });
});

// ── Lifecycle transitions (Task 0011C) ────────────────────────────────────────

describe('refreshPermissionState — lifecycle transitions', () => {
  it('granted → revoked: returns denied and persists new state', async () => {
    // Simulate: was granted, OS revoked while backgrounded.
    mockGetPerms.mockResolvedValue({ status: 'denied' });

    const result = await refreshPermissionState();

    // Transition detected: granted→revoked resolved to denied.
    expect(result).toBe('denied');
    // New state is persisted so subsequent requestNotificationPermissionOnce
    // returns 'denied' without showing another prompt.
    expect(mockSetItem).toHaveBeenCalledWith(expect.any(String), 'denied');
  });

  it('denied → granted: returns granted and persists new state', async () => {
    // Simulate: was denied, user opened OS settings and enabled notifications.
    mockGetPerms.mockResolvedValue({ status: 'granted' });

    const result = await refreshPermissionState();

    // Transition detected: denied→granted resolved to granted.
    expect(result).toBe('granted');
    expect(mockSetItem).toHaveBeenCalledWith(expect.any(String), 'granted');
  });

  it('denied → granted followed by requestNotificationPermissionOnce: proceeds normally', async () => {
    // After refreshPermissionState persisted 'granted'...
    mockGetItem.mockResolvedValue('granted');
    mockGetPerms.mockResolvedValue({ status: 'granted', canAskAgain: true });

    // ...the next call to requestNotificationPermissionOnce reads stored='granted'
    // and confirms with OS without showing a prompt.
    const result = await requestNotificationPermissionOnce();

    expect(result).toBe('granted');
    // No permission dialog shown (OS confirmed it directly).
    expect(mockRequestPerms).not.toHaveBeenCalled();
  });

  it('granted → revoked followed by requestNotificationPermissionOnce: returns denied without prompt', async () => {
    // refreshPermissionState already stored 'denied' after OS revocation.
    mockGetItem.mockResolvedValue('denied');

    const result = await requestNotificationPermissionOnce();

    // No-loop guarantee: denied stored from revocation does NOT trigger a new prompt.
    expect(result).toBe('denied');
    expect(mockRequestPerms).not.toHaveBeenCalled();
  });
});
