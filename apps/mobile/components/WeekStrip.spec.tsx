import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { adaptiveWeekDays, buildWeekDays, resolveWeekSwipe, WeekStrip } from './WeekStrip';
import { localMidnightToInstant, toCanonicalDateParam } from '../lib/timezone';

describe('WeekStrip', () => {
  it('builds exactly Monday through Sunday across month and year boundaries', () => {
    const december = buildWeekDays('2025-12-31', '2025-12-31');
    expect(december.map((day) => day.weekday)).toEqual(['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']);
    expect(december.map((day) => day.date)).toEqual([
      '2025-12-29', '2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04',
    ]);
  });

  it('uses a five-day functional fallback only for combined extreme scale', () => {
    const days = buildWeekDays('2025-12-31', '2025-12-31');
    expect(adaptiveWeekDays(days, 320, 2).map((day) => day.date)).toEqual([
      '2025-12-29', '2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02',
    ]);
    expect(adaptiveWeekDays(days, 320, 1.6)).toHaveLength(7);
    expect(adaptiveWeekDays(days, 400, 2)).toHaveLength(7);
  });

  it('keeps selection distinct from the calm today marker and changes canonical day', () => {
    const onSelectDate = jest.fn();
    render(
      <WeekStrip
        selectedDate="2026-08-16"
        todayDate="2026-08-15"
        canGoPrevious
        onPreviousWeek={jest.fn()}
        onNextWeek={jest.fn()}
        onSelectDate={onSelectDate}
      />,
    );
    expect(screen.getAllByRole('tab')).toHaveLength(7);
    expect(screen.getByTestId('week-day-2026-08-16').props.accessibilityState).toEqual({ selected: true, disabled: false });
    expect(screen.getByTestId('today-marker')).toBeTruthy();
    expect(screen.getByLabelText(/сегодня/).props.accessibilityState).toEqual({ selected: false, disabled: false });
    fireEvent.press(screen.getByTestId('week-day-2026-08-16'));
    expect(onSelectDate).toHaveBeenCalledWith('2026-08-16');
  });

  it('keeps past dates selectable for timeline history', () => {
    const onSelectDate = jest.fn();
    render(
      <WeekStrip
        selectedDate="2026-08-15"
        todayDate="2026-08-15"
        canGoPrevious={false}
        onPreviousWeek={jest.fn()}
        onNextWeek={jest.fn()}
        onSelectDate={onSelectDate}
      />,
    );

    expect(screen.getByTestId('week-day-2026-08-14').props.accessibilityState.disabled).toBe(false);
    fireEvent.press(screen.getByTestId('week-day-2026-08-14'));
    expect(onSelectDate).toHaveBeenCalledWith('2026-08-14');
    fireEvent.press(screen.getByTestId('week-day-2026-08-15'));
    expect(onSelectDate).toHaveBeenCalledWith('2026-08-15');
  });

  it('resolves horizontal week swipes in both directions', () => {
    expect(resolveWeekSwipe(-60, 0, false)).toBe('next');
    expect(resolveWeekSwipe(60, 0, true)).toBe('previous');
    expect(resolveWeekSwipe(20, 0.6, true)).toBe('previous');
    expect(resolveWeekSwipe(20, 0.2, true)).toBeNull();
  });

  it('offers week navigation as accessibility actions on the selected day', () => {
    const onPreviousWeek = jest.fn();
    const onNextWeek = jest.fn();
    render(
      <WeekStrip
        selectedDate="2026-08-22"
        todayDate="2026-08-15"
        canGoPrevious
        onPreviousWeek={onPreviousWeek}
        onNextWeek={onNextWeek}
        onSelectDate={jest.fn()}
      />,
    );

    const selectedDay = screen.getByTestId('week-day-2026-08-22');
    fireEvent(selectedDay, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    fireEvent(selectedDay, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(onNextWeek).toHaveBeenCalledTimes(1);
    expect(onPreviousWeek).toHaveBeenCalledTimes(1);
  });

  it.each(['2026-03-08', '2026-11-01'])('uses calendar arithmetic through DST week %s', (selectedDate) => {
    const days = buildWeekDays(selectedDate, selectedDate);
    expect(days).toHaveLength(7);
    expect(days[6].date).toBe(selectedDate);
  });

  it('preserves canonical days through real spring-forward and fall-back transitions', () => {
    const zone = 'America/New_York';
    const springStart = localMidnightToInstant('2026-03-08', zone);
    const springEnd = localMidnightToInstant('2026-03-09', zone);
    const fallStart = localMidnightToInstant('2026-11-01', zone);
    const fallEnd = localMidnightToInstant('2026-11-02', zone);
    expect(springEnd.getTime() - springStart.getTime()).toBe(23 * 60 * 60 * 1000);
    expect(fallEnd.getTime() - fallStart.getTime()).toBe(25 * 60 * 60 * 1000);
    expect(toCanonicalDateParam(springStart, zone)).toBe('2026-03-08');
    expect(toCanonicalDateParam(fallStart, zone)).toBe('2026-11-01');
  });

  it('uses the profile day even when the device instant is on another UTC day', () => {
    const instant = new Date('2026-08-15T23:30:00.000Z');
    expect(toCanonicalDateParam(instant, 'Asia/Tokyo')).toBe('2026-08-16');
    expect(buildWeekDays('2026-08-16', '2026-08-16')[6].selected).toBe(true);
  });
});
