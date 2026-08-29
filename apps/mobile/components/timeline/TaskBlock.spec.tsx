import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { Task } from '@focus/shared-types';
import { TaskBlock } from './TaskBlock';
import { computeTimelineLayout } from '../../lib/timeline-layout';
import { TIMELINE_CONFIG } from '../../lib/timeline-config';

const makeTask = (id: string, startTime: string, durationMinutes: number | null): Task => ({
  id, userId: 'u', title: id, startTime: new Date(startTime), durationMinutes,
  color: '#6B5BFC', isRecurring: false, recurrenceRule: null, parentTaskId: null,
  completedAt: null, startedAt: null, firstStep: null, subTasks: [],
  createdAt: new Date(), updatedAt: new Date(),
});

it('uses the same Moscow 14:30 coordinate as overlap layout and keeps unknown duration visual-only', () => {
  const unknown = makeTask('unknown', '2026-08-13T11:30:00.000Z', null);
  const overlap = makeTask('overlap', '2026-08-13T11:35:00.000Z', 15);
  const layout = computeTimelineLayout([unknown, overlap], 'Europe/Moscow');
  render(<TaskBlock task={unknown} profileTimezone="Europe/Moscow" onToggle={jest.fn()} onOpen={jest.fn()} />);
  const row = screen.getByTestId('task-block-row-unknown');
  expect(row?.props.style[1].top).toBe((14.5 - TIMELINE_CONFIG.dayStartHour) * TIMELINE_CONFIG.hourHeight);
  expect(row?.props.style[1].height).toBe(TIMELINE_CONFIG.minBlockHeight);
  expect(layout.get('unknown')?.columnCount).toBe(2);
  expect(unknown.durationMinutes).toBeNull();
});

describe('TaskBlock compact state treatment', () => {
  it.each([
    { state: 'normal', isCurrent: false, completedAt: null },
    { state: 'current', isCurrent: true, completedAt: null },
    { state: 'completed', isCurrent: false, completedAt: new Date() },
  ])('keeps title and $state cues inside a 32-unit block', ({ state, isCurrent, completedAt }) => {
    const task = {
      ...makeTask(state, '2026-08-13T11:30:00.000Z', 1),
      title: 'Короткая задача',
      completedAt,
      subTasks: [{ id: 'subtask', title: 'Шаг', completedAt: null }],
    } as Task;

    render(
      <TaskBlock
        task={task}
        isCurrent={isCurrent}
        onToggle={jest.fn()}
        onOpen={jest.fn()}
      />,
    );

    expect(screen.getByTestId(`task-block-row-${state}`).props.style[1].height).toBe(32);
    expect(screen.getByText('Короткая задача')).toBeTruthy();
    expect(screen.queryByText('0/1')).toBeNull();

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox.props.accessibilityState.checked).toBe(Boolean(completedAt));
    if (state === 'current') {
      expect(screen.getByText('Сейчас')).toBeTruthy();
      expect(checkbox.props.accessibilityLabel).toContain('Сейчас');
    }
    if (state === 'completed') {
      expect(screen.getByText('✓')).toBeTruthy();
      expect(checkbox.props.accessibilityLabel).toContain('Выполнено');
    }
  });
});
