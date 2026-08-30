import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ProgressRing } from './ProgressRing';

describe('ProgressRing rendering', () => {
  it('renders a visible value and matching Russian accessibility value', () => {
    render(<ProgressRing completed={2} total={4} />);

    expect(screen.getByText('2 из 4')).toBeTruthy();
    const progress = screen.getByRole('progressbar');
    expect(progress.props.accessibilityLabel).toBe(
      'Прогресс дня: выполнено 2 из 4, 50 процентов',
    );
    expect(progress.props.accessibilityValue).toEqual({
      min: 0,
      max: 100,
      now: 50,
      text: '2 из 4',
    });
  });

  it.each([
    { completed: -3, total: 4, text: '0 из 4', now: 0 },
    { completed: 8, total: 4, text: '4 из 4', now: 100 },
    { completed: Number.NaN, total: Number.NaN, text: '0 задач', now: 0 },
  ])('clamps unsafe values: $text', ({ completed, total, text, now }) => {
    render(<ProgressRing completed={completed} total={total} />);

    expect(screen.getByText(text)).toBeTruthy();
    expect(screen.getByRole('progressbar').props.accessibilityValue.now).toBe(now);
  });
});
