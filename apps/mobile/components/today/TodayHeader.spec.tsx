import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { TodayHeader } from './TodayHeader';

const baseProps = {
  isToday: true,
  now: new Date('2026-08-15T10:00:00Z'),
  profileTimezone: 'UTC',
  dateLabel: 'суббота, 15 августа',
  selectedDateKey: '2026-08-15',
  todayDateKey: '2026-08-15',
  completed: 0,
  total: 0,
  canGoPrevious: false,
  onPreviousWeek: jest.fn(),
  onNextWeek: jest.fn(),
  onSelectDate: jest.fn(),
  onOpenDatePicker: jest.fn(),
};

describe('TodayHeader progress state', () => {
  it.each(['loading', 'error'])('does not fabricate progress while %s', () => {
    render(<TodayHeader {...baseProps} progressKnown={false} />);

    expect(screen.queryByText('0 задач')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByTestId('week-strip')).toBeTruthy();
  });

  it('shows truthful zero progress after a successful empty response', () => {
    render(<TodayHeader {...baseProps} progressKnown />);

    expect(screen.getByText('0 задач')).toBeTruthy();
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('keeps the compact header factual without motivational support copy', () => {
    render(<TodayHeader {...baseProps} progressKnown total={2} />);

    expect(screen.getByText('Доброе утро')).toBeTruthy();
    expect(screen.getByText('суббота, 15 августа')).toBeTruthy();
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.queryByText('Можно выбрать один посильный шаг.')).toBeNull();
    expect(screen.queryByText('Одного небольшого шага достаточно, чтобы начать.')).toBeNull();
  });

  it('removes the old visible navigation row and day heading', () => {
    render(<TodayHeader {...baseProps} progressKnown />);

    expect(screen.queryByLabelText('Предыдущий день')).toBeNull();
    expect(screen.queryByLabelText('Следующий день')).toBeNull();
    expect(screen.queryByText('Сегодня')).toBeNull();
    expect(screen.queryByText('Ваш день')).toBeNull();
  });

  it('places an accessible date-picker action beside progress', () => {
    const onOpenDatePicker = jest.fn();
    render(<TodayHeader {...baseProps} progressKnown onOpenDatePicker={onOpenDatePicker} />);

    fireEvent.press(screen.getByLabelText('Выбрать дату'));
    expect(onOpenDatePicker).toHaveBeenCalledTimes(1);
  });

  it('has content-driven height so a large wrapped date moves the timeline below it', () => {
    render(<TodayHeader {...baseProps} progressKnown dateLabel="среда, 30 сентября — выбранная будущая дата" />);
    expect(StyleSheet.flatten(screen.getByTestId('today-header').props.style).height).toBeUndefined();
    expect(screen.getByTestId('today-date-label').props.numberOfLines).toBeUndefined();
  });
});
