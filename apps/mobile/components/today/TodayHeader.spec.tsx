import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
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
  onPrevious: jest.fn(),
  onNext: jest.fn(),
  onToday: jest.fn(),
  onSelectDate: jest.fn(),
};

describe('TodayHeader progress state', () => {
  it.each(['loading', 'error'])('does not fabricate progress while %s', () => {
    render(<TodayHeader {...baseProps} progressKnown={false} />);

    expect(screen.queryByText('0 задач')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByText('Ваш день')).toBeTruthy();
    expect(screen.getByLabelText('Предыдущий день')).toBeTruthy();
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

  it('provides a semantic return-to-Today control', () => {
    const onToday = jest.fn();
    render(
      <TodayHeader
        {...baseProps}
        isToday={false}
        selectedDateKey="2026-08-16"
        progressKnown
        onToday={onToday}
      />,
    );

    const control = screen.getByLabelText('Вернуться к сегодняшнему дню');
    expect(control.props.accessibilityRole).toBe('button');
    fireEvent.press(control);
    expect(onToday).toHaveBeenCalledTimes(1);
  });
});
