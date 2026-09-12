import React from 'react';
import { render, screen } from '@testing-library/react-native';
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
});
