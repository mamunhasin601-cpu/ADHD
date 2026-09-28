import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
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
      expect(screen.getByRole('button').props.accessibilityLabel).toContain('Сейчас');
    }
    if (state === 'completed') {
      expect(screen.getByText('✓')).toBeTruthy();
      expect(checkbox.props.accessibilityLabel).toContain('Вернуть');
    }
  });
});

it('separates open, completion, and long-press actions', () => {
  const onToggle = jest.fn();
  const onOpen = jest.fn();
  const onShowActions = jest.fn();
  const task = makeTask('actions', '2026-08-13T11:30:00.000Z', 60);
  render(<TaskBlock task={task} onToggle={onToggle} onOpen={onOpen} onShowActions={onShowActions} timeFormat="H24" />);

  fireEvent.press(screen.getByTestId('task-completion-actions'));
  expect(onToggle).toHaveBeenCalledWith(task.id);
  expect(onOpen).not.toHaveBeenCalled();

  fireEvent.press(screen.getByRole('button'));
  expect(onOpen).toHaveBeenCalledWith(task);

  fireEvent(screen.getByRole('button'), 'longPress');
  expect(onShowActions).toHaveBeenCalledWith(task);
});

it('keeps the card neutral and uses the exact selected task color as an accent rail', () => {
  const task = { ...makeTask('bright', '2026-08-13T11:30:00.000Z', 60), color: '#F97316' };
  render(<TaskBlock task={task} onToggle={jest.fn()} onOpen={jest.fn()} timeFormat="H24" />);
  const card = screen.getByRole('button');
  const flatCard = require('react-native').StyleSheet.flatten(card.props.style);
  expect(flatCard.backgroundColor).not.toBe('#F97316');
  const rail = require('react-native').StyleSheet.flatten(screen.getByTestId('task-duration-rail-bright').props.style);
  expect(rail).toEqual(expect.objectContaining({ left: 0, width: 5, backgroundColor: '#F97316' }));
});

describe('started elapsed overlay', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-08-13T12:20:00.000Z')));
  afterEach(() => jest.useRealTimers());

  it('refreshes once per minute, exposes elapsed state, and caps overtime fill', () => {
    const started = {
      ...makeTask('started', '2026-08-13T12:00:00.000Z', 30),
      startedAt: new Date('2026-08-13T12:00:00.000Z'),
    };
    const view = render(<TaskBlock task={started} nowMs={Date.now()} layoutHeight={72} onToggle={jest.fn()} onOpen={jest.fn()} timeFormat="H24" profileTimezone="UTC" />);
    expect(screen.getByTestId('task-elapsed-fill-path-started').props.d).not.toBe('');
    expect(screen.getByRole('button').props.accessibilityLabel).toContain('20 минут из 30');
    expect(screen.getByTestId('task-scheduled-meta-started').props.children).toBe('12:00  ·  30 мин');
    expect(screen.getByTestId('task-elapsed-label-started').props.children).toBe('Сейчас 12:20 · прошло 20 из 30 мин');

    act(() => jest.advanceTimersByTime(11 * 60_000));
    view.rerender(<TaskBlock task={started} nowMs={Date.now()} layoutHeight={72} onToggle={jest.fn()} onOpen={jest.fn()} timeFormat="H24" profileTimezone="UTC" />);
    expect(screen.getByText(/дольше запланированного/i)).toBeTruthy();
    expect(screen.getByTestId('task-elapsed-fill-path-started').props.d).toBe('M 0 0 L 100 0 L 100 100 L 0 100 Z');
    expect(screen.getByRole('button').props.accessibilityLabel).toContain('Дольше запланированного');
  });

  it('keeps completed and unknown-duration tasks free of inferred progress', () => {
    const completed = {
      ...makeTask('done', '2026-08-13T12:00:00.000Z', 30),
      startedAt: new Date('2026-08-13T12:00:00.000Z'),
      completedAt: new Date('2026-08-13T12:10:00.000Z'),
    };
    const { rerender } = render(<TaskBlock task={completed} onToggle={jest.fn()} onOpen={jest.fn()} />);
    expect(screen.queryByTestId('task-elapsed-fill-done')).toBeNull();
    rerender(<TaskBlock task={{ ...completed, id: 'unknown', completedAt: null, durationMinutes: null }} onToggle={jest.fn()} onOpen={jest.fn()} />);
    expect(screen.queryByTestId('task-elapsed-fill-unknown')).toBeNull();
  });

  it('keeps scheduled start/duration and one internal H12 current-time line after explicit Start', () => {
    const started = {
      ...makeTask('h12-started', '2026-08-13T23:10:00.000Z', 60),
      startedAt: new Date('2026-08-13T23:10:00.000Z'),
    };
    render(
      <TaskBlock
        task={started}
        nowMs={new Date('2026-08-13T23:11:00.000Z').getTime()}
        layoutHeight={94}
        onToggle={jest.fn()}
        onOpen={jest.fn()}
        timeFormat="H12"
        profileTimezone="UTC"
      />,
    );
    expect(screen.getByTestId('task-scheduled-meta-h12-started').props.children).toMatch(/11:10\s*PM\s+·\s+60 мин/);
    expect(screen.getByTestId('task-elapsed-label-h12-started').props.children).toMatch(/Сейчас 11:11\s*PM · прошло 1 из 60 мин/);
    const label = screen.getByRole('button').props.accessibilityLabel;
    expect(label).toMatch(/Запланировано на 11:10\s*PM, 60 мин/);
    expect(label).toMatch(/Сейчас 11:11\s*PM/);
  });

  it.each([
    ['2026-08-13T12:00:00.000Z', /12:00\s*PM/],
    ['2026-08-13T12:05:00.000Z', /12:05\s*PM/],
    ['2026-08-13T23:59:00.000Z', /11:59\s*PM/],
  ])('keeps the H12 token for %s on one scheduled metadata line', (startTime, expected) => {
    const entry = makeTask(`h12-${startTime}`, startTime, 60);
    render(<TaskBlock task={entry} layoutHeight={72} onToggle={jest.fn()} onOpen={jest.fn()} timeFormat="H12" profileTimezone="UTC" />);
    const meta = screen.getByTestId(`task-scheduled-meta-${entry.id}`);
    expect(meta.props.numberOfLines).toBe(1);
    expect(meta.props.children).toMatch(expected);
  });

  it('uses the H24 analogue and does not infer fill for a merely overdue schedule', () => {
    const overdueSchedule = makeTask('scheduled-overdue', '2026-08-13T11:10:00.000Z', 60);
    render(
      <TaskBlock
        task={overdueSchedule}
        nowMs={new Date('2026-08-13T23:11:00.000Z').getTime()}
        layoutHeight={72}
        onToggle={jest.fn()}
        onOpen={jest.fn()}
        timeFormat="H24"
        profileTimezone="UTC"
      />,
    );
    expect(screen.getByText('11:10  ·  60 мин')).toBeTruthy();
    expect(screen.queryByTestId('task-elapsed-fill-scheduled-overdue')).toBeNull();
    expect(screen.queryByText(/Дольше запланированного/)).toBeNull();
  });

  it('lets a long title and overdue metadata report their natural measured height', () => {
    const onMeasuredHeight = jest.fn();
    const started = {
      ...makeTask('long-overdue', '2026-08-13T10:00:00.000Z', 30),
      title: 'Очень длинное название задачи, которое должно переноситься без наложения на соседний отдых',
      startedAt: new Date('2026-08-12T10:00:00.000Z'),
    };
    render(
      <TaskBlock
        task={started}
        nowMs={new Date('2026-08-13T12:00:00.000Z').getTime()}
        layoutHeight={94}
        onToggle={jest.fn()}
        onOpen={jest.fn()}
        onMeasuredHeight={onMeasuredHeight}
      />,
    );
    expect(screen.getByText(started.title).props.numberOfLines).toBe(3);
    expect(screen.getByTestId('task-elapsed-label-long-overdue').props.numberOfLines).toBeUndefined();
    fireEvent(screen.getByTestId('task-copy-long-overdue'), 'layout', { nativeEvent: { layout: { height: 86 } } });
    expect(onMeasuredHeight).toHaveBeenCalledWith('long-overdue', 100);
  });
});
