import * as SecureStore from 'expo-secure-store';
import { useRecoveryUndoHistory } from './recovery-undo-history';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockGet = SecureStore.getItemAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue(null);
  useRecoveryUndoHistory.setState({ entries: [], hydratedUsers: {} });
});

describe('recovery undo history', () => {
  it('persists an undo entry under its owner', () => {
    useRecoveryUndoHistory.getState().record({
      id: 'undo-1',
      userId: 'user-a',
      taskCount: 2,
      createdAt: 100,
      expiresAt: Date.now() + 60_000,
    });

    expect(useRecoveryUndoHistory.getState().entries).toHaveLength(1);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'focus-recovery-undo-v1:user-a',
      expect.stringContaining('undo-1'),
    );
  });

  it('drops expired entries while hydrating', async () => {
    mockGet.mockResolvedValue(JSON.stringify([
      { id: 'expired', userId: 'user-a', taskCount: 1, createdAt: 1, expiresAt: Date.now() - 1 },
      { id: 'ready', userId: 'user-a', taskCount: 1, createdAt: 2, expiresAt: Date.now() + 60_000 },
    ]));

    await useRecoveryUndoHistory.getState().hydrate('user-a');

    expect(useRecoveryUndoHistory.getState().entries.map((entry) => entry.id)).toEqual(['ready']);
  });
});
