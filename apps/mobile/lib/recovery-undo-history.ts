import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const STORAGE_PREFIX = 'focus-recovery-undo-v1';

export type RecoveryUndoEntry = {
  id: string;
  userId: string;
  taskCount: number;
  createdAt: number;
  expiresAt: number;
};

type RecoveryUndoHistoryState = {
  entries: RecoveryUndoEntry[];
  hydratedUsers: Record<string, true>;
  hydrate: (userId: string) => Promise<void>;
  record: (entry: RecoveryUndoEntry) => void;
  remove: (userId: string, undoId: string) => void;
  prune: (userId: string, now?: number) => void;
};

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`;
}

function isEntry(value: unknown): value is RecoveryUndoEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<RecoveryUndoEntry>;
  return typeof entry.id === 'string' &&
    typeof entry.userId === 'string' &&
    typeof entry.taskCount === 'number' &&
    typeof entry.createdAt === 'number' &&
    typeof entry.expiresAt === 'number';
}

async function loadEntries(userId: string): Promise<RecoveryUndoEntry[]> {
  try {
    const raw = await SecureStore.getItemAsync(storageKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry).filter((entry) => entry.userId === userId && entry.expiresAt > Date.now());
  } catch {
    return [];
  }
}

function persist(userId: string, entries: RecoveryUndoEntry[]) {
  const current = entries.filter((entry) => entry.userId === userId && entry.expiresAt > Date.now());
  void SecureStore.setItemAsync(storageKey(userId), JSON.stringify(current)).catch(() => undefined);
}

function mergeEntries(first: RecoveryUndoEntry[], second: RecoveryUndoEntry[]): RecoveryUndoEntry[] {
  const byId = new Map<string, RecoveryUndoEntry>();
  for (const entry of [...first, ...second]) byId.set(entry.id, entry);
  return Array.from(byId.values()).sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Keeps the short Today confirmation separate from the longer server Undo
 * window. Entries are scoped to the authenticated user and survive tab
 * changes/app restarts for as long as the backend still accepts the undoId.
 */
export const useRecoveryUndoHistory = create<RecoveryUndoHistoryState>((set, get) => ({
  entries: [],
  hydratedUsers: {},

  hydrate: async (userId) => {
    if (get().hydratedUsers[userId]) return;
    const stored = await loadEntries(userId);
    set((state) => ({
      entries: mergeEntries(
        state.entries.filter((entry) => entry.userId !== userId),
        mergeEntries(stored, state.entries.filter((entry) => entry.userId === userId)),
      ),
      hydratedUsers: { ...state.hydratedUsers, [userId]: true },
    }));
    persist(userId, get().entries);
  },

  record: (entry) => {
    set((state) => ({
      entries: mergeEntries(
        state.entries.filter((item) => item.id !== entry.id),
        [entry],
      ),
    }));
    persist(entry.userId, get().entries);
  },

  remove: (userId, undoId) => {
    set((state) => ({ entries: state.entries.filter((entry) => entry.id !== undoId) }));
    persist(userId, get().entries);
  },

  prune: (userId, now = Date.now()) => {
    const before = get().entries;
    const after = before.filter((entry) => entry.userId !== userId || entry.expiresAt > now);
    if (after.length === before.length) return;
    set({ entries: after });
    persist(userId, after);
  },
}));
