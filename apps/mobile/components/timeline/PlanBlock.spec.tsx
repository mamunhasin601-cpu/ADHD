import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { Task, TimeFormat } from '@focus/shared-types';
import { TIMELINE_CONFIG } from '../../lib/timeline-config';
import { PlanBlock } from './PlanBlock';

function makeBlock(kind: 'REST' | 'BUFFER', durationMinutes: number | null = 45): Task {
  return {
    id: kind.toLowerCase(),
    userId: 'owner',
    title: kind === 'REST' ? 'Тихая пауза' : 'Дорога',
    kind,
    startTime: new Date('2026-08-19T11:30:00.000Z'),
    durationMinutes,
    color: '#6B5BFC',
    isRecurring: false,
    recurrenceRule: null,
    parentTaskId: null,
    completedAt: null,
    startedAt: null,
    firstStep: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

it.each([
  ['REST', 'Отдых', 'Тихая пауза'],
  ['BUFFER', 'Буфер', 'Дорога'],
] as const)('renders %s distinctly and opens editing without a completion action', (kind, typeLabel, title) => {
  const onOpen = jest.fn();
  const task = makeBlock(kind);
  render(<PlanBlock task={task} onOpen={onOpen} timeFormat="H24" profileTimezone="Europe/Moscow" />);

  expect(screen.getByText(typeLabel)).toBeTruthy();
  expect(screen.getByText(title)).toBeTruthy();
  expect(screen.queryByLabelText(/выполн/i)).toBeNull();
  fireEvent.press(screen.getByRole('button'));
  expect(onOpen).toHaveBeenCalledWith(task);
});

it.each([
  ['H24', 'с 14:30 до 15:15'],
  ['H12', 'с 2:30 PM до 3:15 PM'],
] as [TimeFormat, string][])('changes only the accessibility clock presentation for %s', (timeFormat, clock) => {
  render(<PlanBlock task={makeBlock('REST')} onOpen={jest.fn()} timeFormat={timeFormat} profileTimezone="Europe/Moscow" />);
  expect(screen.getByRole('button').props.accessibilityLabel).toContain(clock);
  const row = screen.getByTestId('plan-block-row-rest');
  expect(row.props.style[1]).toEqual(expect.objectContaining({
    top: (14.5 - TIMELINE_CONFIG.dayStartHour) * TIMELINE_CONFIG.hourHeight,
    height: 0.75 * TIMELINE_CONFIG.hourHeight,
  }));
});

it('keeps an invalid unknown-duration block as an uncertainty presentation', () => {
  render(<PlanBlock task={makeBlock('BUFFER', null)} onOpen={jest.fn()} timeFormat="H24" profileTimezone="Europe/Moscow" />);
  expect(screen.getByRole('button').props.accessibilityLabel).toContain('начало 14:30, время окончания и длительность не указаны');
  expect(screen.getByTestId('plan-block-row-buffer').props.style[1].height).toBe(TIMELINE_CONFIG.minBlockHeight);
});
