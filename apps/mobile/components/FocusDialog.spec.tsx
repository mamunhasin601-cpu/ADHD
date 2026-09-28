import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { FocusDialog } from './FocusDialog';
import { ORBITS_THEMES, OrbitsThemeProvider } from '../theme/orbits';

it('uses the selected Focus background and theme tokens', () => {
  render(
    <OrbitsThemeProvider theme="dark">
      <FocusDialog visible title="Заголовок" message="Сообщение" onDismiss={jest.fn()} />
    </OrbitsThemeProvider>,
  );

  expect(StyleSheet.flatten(screen.getByTestId('focus-dialog').props.style)).toEqual(
    expect.objectContaining({
      backgroundColor: ORBITS_THEMES.dark.background,
      borderColor: ORBITS_THEMES.dark.borderSubtle,
      shadowColor: ORBITS_THEMES.dark.elevationShadow,
    }),
  );
  const scrim = screen.UNSAFE_getByProps({ testID: 'focus-dialog-scrim' });
  expect(StyleSheet.flatten(scrim.props.style)).toEqual(
    expect.objectContaining({ backgroundColor: ORBITS_THEMES.dark.elevationShadow }),
  );
});

it('closes one-button information dialogs', () => {
  const onDismiss = jest.fn();
  render(<FocusDialog visible title="Готово" message="Можно продолжить" onDismiss={onDismiss} />);

  fireEvent.press(screen.getByRole('button', { name: 'ОК' }));

  expect(onDismiss).toHaveBeenCalledTimes(1);
});

it('preserves action order and only confirms from the selected action', () => {
  const onDismiss = jest.fn();
  const onConfirm = jest.fn();
  render(
    <FocusDialog
      visible
      title="Удалить?"
      onDismiss={onDismiss}
      actions={[
        { text: 'Отмена', style: 'cancel' },
        { text: 'Удалить', style: 'destructive', onPress: onConfirm },
      ]}
    />,
  );

  expect([
    screen.UNSAFE_getByProps({ testID: 'focus-dialog-backdrop' }).props.accessibilityLabel,
    screen.getByTestId('focus-dialog-action-0').props.accessibilityLabel,
    screen.getByTestId('focus-dialog-action-1').props.accessibilityLabel,
  ]).toEqual(['Закрыть диалог', 'Отмена', 'Удалить']);
  fireEvent.press(screen.getByRole('button', { name: 'Удалить' }));

  expect(onDismiss).toHaveBeenCalledTimes(1);
  expect(onConfirm).toHaveBeenCalledTimes(1);
});

it.each(['backdrop', 'Android Back'] as const)('dismisses from %s without confirming', (source) => {
  const onDismiss = jest.fn();
  const onConfirm = jest.fn();
  render(
    <FocusDialog
      visible
      title="Подтвердить?"
      onDismiss={onDismiss}
      actions={[{ text: 'Да', onPress: onConfirm }]}
    />,
  );

  if (source === 'backdrop') fireEvent.press(screen.UNSAFE_getByProps({ testID: 'focus-dialog-backdrop' }));
  else screen.getByTestId('focus-dialog-modal').props.onRequestClose();

  expect(onDismiss).toHaveBeenCalledTimes(1);
  expect(onConfirm).not.toHaveBeenCalled();
});

it('marks the surface as a modal alert and requests accessibility focus on show', () => {
  render(<FocusDialog visible title="Ошибка" message="Попробуйте снова" onDismiss={jest.fn()} />);

  const dialog = screen.getByTestId('focus-dialog');
  expect(dialog.props.accessibilityRole).toBe('alert');
  expect(dialog.props.accessibilityViewIsModal).toBe(true);
  expect(screen.getByTestId('focus-dialog-modal').props.onShow).toEqual(expect.any(Function));
  expect(() => screen.getByTestId('focus-dialog-modal').props.onShow()).not.toThrow();
});
