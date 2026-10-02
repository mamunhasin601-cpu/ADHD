import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ORBITS_THEMES, OrbitsThemeProvider } from '../../theme/orbits';
import { buildFocusCalendarMonth, FocusDatePicker } from './FocusDatePicker';

const baseProps = {
  visible: true,
  selectedDate: '2026-09-13',
  todayDate: '2026-09-13',
  onClose: jest.fn(),
  onConfirm: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

it('builds a Monday-first month without changing calendar date identity', () => {
  const cells = buildFocusCalendarMonth('2026-09-01');

  expect(cells).toHaveLength(35);
  expect(cells[0]).toEqual(expect.objectContaining({ day: null, date: null }));
  expect(cells[1]).toEqual(expect.objectContaining({ day: 1, date: '2026-09-01' }));
  expect(cells.at(-1)).toEqual(expect.objectContaining({ day: null, date: null }));
});

it('selects a date immediately so the parent can close the calendar and open that day', () => {
  render(<FocusDatePicker {...baseProps} />);

  fireEvent.press(screen.getByTestId('focus-calendar-day-2026-09-14'));

  expect(baseProps.onConfirm).toHaveBeenCalledTimes(1);
  expect(baseProps.onConfirm).toHaveBeenCalledWith('2026-09-14');
});

it('also confirms the already selected date when it is pressed', () => {
  render(<FocusDatePicker {...baseProps} />);

  fireEvent.press(screen.getByTestId('focus-calendar-day-2026-09-13'));

  expect(baseProps.onConfirm).toHaveBeenCalledWith('2026-09-13');
});

it('moves between months without closing the calendar', () => {
  render(<FocusDatePicker {...baseProps} />);

  fireEvent.press(screen.getByLabelText('Следующий месяц'));
  expect(screen.getByText(/Октябрь 2026/)).toBeTruthy();
  expect(baseProps.onClose).not.toHaveBeenCalled();
  expect(baseProps.onConfirm).not.toHaveBeenCalled();
});

it('confirms the current selection with the compact OK action', () => {
  render(<FocusDatePicker {...baseProps} />);

  fireEvent.press(screen.getByTestId('focus-date-picker-confirm'));

  expect(screen.getByText('ОК')).toBeTruthy();
  expect(baseProps.onConfirm).toHaveBeenCalledWith('2026-09-13');
});

it('cancels without changing the selected date', () => {
  render(<FocusDatePicker {...baseProps} />);

  fireEvent.press(screen.getByTestId('focus-date-picker-cancel'));

  expect(baseProps.onClose).toHaveBeenCalledTimes(1);
  expect(baseProps.onConfirm).not.toHaveBeenCalled();
});

it('dismisses through the backdrop without changing the selected date', () => {
  render(<FocusDatePicker {...baseProps} />);

  fireEvent.press(screen.getByTestId('focus-date-picker-backdrop'));

  expect(baseProps.onClose).toHaveBeenCalledTimes(1);
  expect(baseProps.onConfirm).not.toHaveBeenCalled();
});

it('dismisses through Android Back without changing the selected date', () => {
  render(<FocusDatePicker {...baseProps} />);

  screen.getByTestId('focus-date-picker-modal').props.onRequestClose();

  expect(baseProps.onClose).toHaveBeenCalledTimes(1);
  expect(baseProps.onConfirm).not.toHaveBeenCalled();
});

it('uses the active dark theme instead of native Android calendar colors', () => {
  render(
    <OrbitsThemeProvider theme="dark">
      <FocusDatePicker {...baseProps} />
    </OrbitsThemeProvider>,
  );

  expect(StyleSheet.flatten(screen.getByTestId('today-date-picker').props.style)).toEqual(
    expect.objectContaining({
      backgroundColor: ORBITS_THEMES.dark.surfacePrimary,
      borderColor: ORBITS_THEMES.dark.borderSubtle,
    }),
  );
  expect(StyleSheet.flatten(screen.getByTestId('focus-date-picker-scrim').props.style)).toEqual(
    expect.objectContaining({ backgroundColor: ORBITS_THEMES.dark.elevationShadow }),
  );
  expect(StyleSheet.flatten(screen.getByTestId('focus-calendar-day-2026-09-13').props.style)).toEqual(
    expect.objectContaining({ backgroundColor: ORBITS_THEMES.dark.brand }),
  );
});
