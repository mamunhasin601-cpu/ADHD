import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { PartialReminderNotice } from './PartialReminderNotice';

describe('PartialReminderNotice', () => {
  it('renders neutral success copy (not an error)', () => {
    render(<PartialReminderNotice onDismiss={jest.fn()} />);
    expect(screen.getByTestId('partial-reminder-notice')).toBeTruthy();
    expect(screen.getByText('Задачи перенесены')).toBeTruthy();
    expect(screen.getByText(/Некоторые напоминания не удалось обновить/)).toBeTruthy();
  });

  it('has dismiss button', () => {
    render(<PartialReminderNotice onDismiss={jest.fn()} />);
    expect(screen.getByTestId('partial-reminder-dismiss')).toBeTruthy();
  });

  it('pressing dismiss calls onDismiss', () => {
    const onDismiss = jest.fn();
    render(<PartialReminderNotice onDismiss={onDismiss} />);
    fireEvent.press(screen.getByTestId('partial-reminder-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('has accessible alert role', () => {
    render(<PartialReminderNotice onDismiss={jest.fn()} />);
    const notice = screen.getByTestId('partial-reminder-notice');
    expect(notice.props.accessibilityRole).toBe('alert');
  });

  it('dismiss button has minWidth/minHeight >= 44 (touch target)', () => {
    render(<PartialReminderNotice onDismiss={jest.fn()} />);
    const btn = screen.getByTestId('partial-reminder-dismiss');
    const flatStyle = btn.props.style;
    const styles = Array.isArray(flatStyle) ? flatStyle : [flatStyle];
    const combined = Object.assign({}, ...styles.filter(Boolean));
    expect(typeof combined.minWidth).toBe('number');
    expect(typeof combined.minHeight).toBe('number');
    expect(combined.minWidth).toBeGreaterThanOrEqual(44);
    expect(combined.minHeight).toBeGreaterThanOrEqual(44);
  });

  it('does not contain task titles or IDs (copy is generic)', () => {
    render(<PartialReminderNotice onDismiss={jest.fn()} />);
    // Verify only the known static strings appear — no dynamic task data
    expect(screen.getByText('Задачи перенесены')).toBeTruthy();
    expect(screen.queryByText(/task-[a-z0-9]+/i)).toBeNull();
  });
});
