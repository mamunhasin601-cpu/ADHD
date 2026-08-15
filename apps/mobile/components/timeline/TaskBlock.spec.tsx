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
