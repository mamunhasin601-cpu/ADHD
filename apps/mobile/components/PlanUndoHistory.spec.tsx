import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PlanUndoHistory } from './PlanUndoHistory';
import { useAuthStore } from '../stores/auth.store';
import { useRecoveryUndoHistory } from '../lib/recovery-undo-history';
import { OrbitsThemeProvider } from '../theme/orbits';

const mockUndo = jest.fn();

jest.mock('../lib/api/tasks', () => ({
  useUndoRecovery: () => ({ mutate: mockUndo, isPending: false }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ user: { id: 'user-a', timezone: 'Europe/Samara' } as any });
  useRecoveryUndoHistory.setState({
    entries: [{
      id: 'undo-1',
      userId: 'user-a',
      taskCount: 1,
      createdAt: Date.now(),
      expiresAt: Date.now() + 10 * 60 * 1000,
    }],
    hydratedUsers: { 'user-a': true, 'user-b': true },
  });
});

function renderHistory() {
  return render(
    <OrbitsThemeProvider theme="dark">
      <PlanUndoHistory />
    </OrbitsThemeProvider>,
  );
}

describe('PlanUndoHistory', () => {
  it('keeps a recent recovery undo available in Plan', () => {
    renderHistory();

    expect(screen.getByTestId('plan-undo-history')).toBeTruthy();
    expect(screen.getByText('1 задача перенесена')).toBeTruthy();
    expect(screen.getByText(/Отмена доступна до/)).toBeTruthy();
  });

  it('undoes once and removes the completed entry', async () => {
    mockUndo.mockImplementation((_id, options) => options.onSuccess());
    renderHistory();

    fireEvent.press(screen.getByTestId('plan-undo-button-undo-1'));

    expect(mockUndo).toHaveBeenCalledWith('undo-1', expect.any(Object));
    await waitFor(() => expect(screen.queryByTestId('plan-undo-undo-1')).toBeNull());
  });

  it('never exposes another user’s undo history', () => {
    useAuthStore.setState({ user: { id: 'user-b', timezone: 'Europe/Samara' } as any });
    renderHistory();

    expect(screen.queryByTestId('plan-undo-history')).toBeNull();
  });
});
