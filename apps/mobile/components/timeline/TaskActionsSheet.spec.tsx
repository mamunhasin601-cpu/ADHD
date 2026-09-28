import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { Task } from '@focus/shared-types';
import { ORBITS_THEMES, OrbitsThemeProvider } from '../../theme/orbits';
import { shouldDismissTaskActionsSheet, TaskActionsSheet } from './TaskActionsSheet';

const task: Task = {
  id: 'task-1', userId: 'user', title: 'Позвонить врачу', startTime: new Date('2026-09-12T10:00:00.000Z'),
  durationMinutes: 20, color: '#F97316', isRecurring: false, recurrenceRule: null, parentTaskId: null,
  completedAt: null, startedAt: null, firstStep: null, createdAt: new Date(), updatedAt: new Date(),
};

it('offers reschedule, Thoughts, and delete actions', () => {
  render(<TaskActionsSheet task={task} visible onClose={jest.fn()} onReschedule={jest.fn()} onMoveToThoughts={jest.fn()} onDelete={jest.fn()} />);
  expect(screen.getByText('Перенести')).toBeTruthy();
  expect(screen.getByText('В «Мысли»')).toBeTruthy();
  expect(screen.getByText('Удалить')).toBeTruthy();
});

it('opens rescheduling and closes the sheet', () => {
  const onClose = jest.fn();
  const onReschedule = jest.fn();
  render(<TaskActionsSheet task={task} visible onClose={onClose} onReschedule={onReschedule} onMoveToThoughts={jest.fn()} onDelete={jest.fn()} />);
  fireEvent.press(screen.getByTestId('task-action-reschedule'));
  expect(onClose).toHaveBeenCalled();
  expect(onReschedule).toHaveBeenCalledWith(task);
});

it('moves an eligible task to Thoughts and closes after success', async () => {
  const onClose = jest.fn();
  const onMoveToThoughts = jest.fn().mockResolvedValue(undefined);
  render(<TaskActionsSheet task={task} visible onClose={onClose} onReschedule={jest.fn()} onMoveToThoughts={onMoveToThoughts} onDelete={jest.fn()} />);
  await act(async () => fireEvent.press(screen.getByTestId('task-action-thoughts')));
  expect(onMoveToThoughts).toHaveBeenCalledWith(task);
  expect(onClose).toHaveBeenCalled();
});

it.each([
  { label: 'started', patch: { startedAt: new Date() } },
  { label: 'recurring occurrence', patch: { seriesId: 'series-1' } },
])('keeps Thoughts active for a $label task', async ({ patch }) => {
  const onMoveToThoughts = jest.fn().mockResolvedValue(undefined);
  render(<TaskActionsSheet task={{ ...task, ...patch }} visible onClose={jest.fn()} onReschedule={jest.fn()} onMoveToThoughts={onMoveToThoughts} onDelete={jest.fn()} />);
  expect(screen.getByTestId('task-action-thoughts').props.accessibilityState.disabled).toBe(false);
  await act(async () => fireEvent.press(screen.getByTestId('task-action-thoughts')));
  expect(onMoveToThoughts).toHaveBeenCalledWith(expect.objectContaining(patch));
});

it('keeps the sheet open and reports a failed Thoughts move', async () => {
  const onClose = jest.fn();
  render(<TaskActionsSheet task={task} visible onClose={onClose} onReschedule={jest.fn()} onMoveToThoughts={jest.fn().mockRejectedValue(new Error('offline'))} onDelete={jest.fn()} />);
  await act(async () => fireEvent.press(screen.getByTestId('task-action-thoughts')));
  expect(await screen.findByRole('alert')).toHaveTextContent(/Не удалось перенести задачу/);
  expect(onClose).not.toHaveBeenCalled();
});

it('confirms deletion and closes only after it succeeds', async () => {
  const onClose = jest.fn();
  const onDelete = jest.fn().mockResolvedValue(undefined);
  render(<TaskActionsSheet task={task} visible onClose={onClose} onReschedule={jest.fn()} onMoveToThoughts={jest.fn()} onDelete={onDelete} />);

  fireEvent.press(screen.getByTestId('task-action-delete'));
  expect(screen.getByTestId('task-delete-confirmation')).toBeTruthy();
  expect(screen.getByText('Удалить задачу?')).toBeTruthy();
  expect(onDelete).not.toHaveBeenCalled();

  await act(async () => fireEvent.press(screen.getByTestId('task-delete-confirm')));
  expect(onDelete).toHaveBeenCalledWith(task);
  expect(onClose).toHaveBeenCalled();
});

it('cancels the in-app deletion confirmation without closing the action sheet', () => {
  const onClose = jest.fn();
  render(<TaskActionsSheet task={task} visible onClose={onClose} onReschedule={jest.fn()} onMoveToThoughts={jest.fn()} onDelete={jest.fn()} />);

  fireEvent.press(screen.getByTestId('task-action-delete'));
  fireEvent.press(screen.getByTestId('task-delete-cancel'));

  expect(screen.queryByTestId('task-delete-confirmation')).toBeNull();
  expect(screen.getByTestId('task-action-delete')).toBeTruthy();
  expect(onClose).not.toHaveBeenCalled();
});

it('uses the current app theme for the sheet and deletion confirmation', () => {
  render(
    <OrbitsThemeProvider theme="dark">
      <TaskActionsSheet task={task} visible onClose={jest.fn()} onReschedule={jest.fn()} onMoveToThoughts={jest.fn()} onDelete={jest.fn()} />
    </OrbitsThemeProvider>,
  );

  expect(StyleSheet.flatten(screen.getByTestId('task-actions-sheet').props.style)).toEqual(
    expect.objectContaining({
      backgroundColor: ORBITS_THEMES.dark.surfacePrimary,
      borderColor: ORBITS_THEMES.dark.borderSubtle,
    }),
  );
  expect(StyleSheet.flatten(screen.getByTestId('task-actions-scrim').props.style)).toEqual(
    expect.objectContaining({ backgroundColor: ORBITS_THEMES.dark.elevationShadow }),
  );
  fireEvent.press(screen.getByTestId('task-action-delete'));
  expect(screen.getByTestId('task-delete-confirmation')).toBeTruthy();
  expect(StyleSheet.flatten(screen.getByTestId('task-delete-confirm').props.style)).toEqual(
    expect.objectContaining({
      backgroundColor: ORBITS_THEMES.dark.errorSoft,
      borderColor: ORBITS_THEMES.dark.errorPrimary,
    }),
  );
});

it('owns the drag handle from touch-down after every presentation', () => {
  const view = render(<TaskActionsSheet task={task} visible onClose={jest.fn()} onReschedule={jest.fn()} onMoveToThoughts={jest.fn()} onDelete={jest.fn()} />);
  let handle = screen.getByTestId('task-actions-drag-handle');
  expect(handle.props.onStartShouldSetResponder()).toBe(true);
  expect(handle.props.onStartShouldSetResponderCapture).toEqual(expect.any(Function));
  expect(handle.props.onResponderMove).toEqual(expect.any(Function));
  expect(handle.props.onResponderRelease).toEqual(expect.any(Function));
  expect(handle.props.onResponderTerminationRequest()).toBe(false);

  view.rerender(<TaskActionsSheet task={null} visible={false} onClose={jest.fn()} onReschedule={jest.fn()} onMoveToThoughts={jest.fn()} onDelete={jest.fn()} />);
  view.rerender(<TaskActionsSheet task={task} visible onClose={jest.fn()} onReschedule={jest.fn()} onMoveToThoughts={jest.fn()} onDelete={jest.fn()} />);
  handle = screen.getByTestId('task-actions-drag-handle');
  expect(handle.props.onStartShouldSetResponder()).toBe(true);
  expect(handle.props.onResponderRelease).toEqual(expect.any(Function));

  expect(shouldDismissTaskActionsSheet(120, 0)).toBe(true);
  expect(shouldDismissTaskActionsSheet(20, 1)).toBe(true);
  expect(shouldDismissTaskActionsSheet(40, 0.2)).toBe(false);
});
