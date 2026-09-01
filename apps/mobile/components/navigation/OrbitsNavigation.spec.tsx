import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { OrbitsNavigation } from './OrbitsNavigation';
import { ORBITS_NAVIGATION_ASSETS } from './orbits-assets';
import { ORBITS_THEMES } from '../../theme/orbits';

const destinations = ['today', 'plan', 'progress', 'profile'] as const;

function setup(overrides: Partial<React.ComponentProps<typeof OrbitsNavigation>> = {}) {
  const onSelect = jest.fn();
  const onAdd = jest.fn();
  render(<OrbitsNavigation activeDestination="today" onSelect={onSelect} onAdd={onAdd} {...overrides} />);
  return { onSelect, onAdd };
}

describe('OrbitsNavigation', () => {
  it('renders the permanent visible order and approved artwork', () => {
    setup();
    const tree = screen.getByTestId('orbits-navigation');
    expect(tree.props.children.map((child: React.ReactElement) => child.key)).toEqual(['today', 'plan', 'add', 'progress', 'profile']);
    expect(['Сегодня', 'План', 'Добавить', 'Успех', 'Профиль'].map((label) => screen.getByText(label).props.children)).toEqual(['Сегодня', 'План', 'Добавить', 'Успех', 'Профиль']);
    expect(screen.queryByText('Прогресс')).toBeNull();
    for (const key of ['today', 'plan', 'add', 'progress', 'profile'] as const) {
      expect(screen.getByTestId(`orbits-${key}-artwork`).props.source).toBe(ORBITS_NAVIGATION_ASSETS[key]);
      expect(screen.getByTestId(`orbits-${key}-artwork`).props.accessible).toBe(false);
    }
  });

  it('exposes exactly one selected destination with a bordered shape, never Add', () => {
    setup({ activeDestination: 'progress' });
    expect(destinations.filter((key) => screen.getByTestId(`orbits-${key}`).props.accessibilityState.selected)).toEqual(['progress']);
    expect(screen.getByTestId('orbits-add').props.accessibilityState).toEqual({ disabled: false, busy: false });
    const activeStyle = StyleSheet.flatten(screen.getByTestId('orbits-progress').props.style);
    expect(activeStyle.borderWidth).toBe(1);
    expect(activeStyle.borderRadius).toBeGreaterThan(0);
  });

  it('dispatches destination identifiers and keeps Add a separate action', () => {
    const { onSelect, onAdd } = setup();
    fireEvent.press(screen.getByTestId('orbits-plan'));
    fireEvent.press(screen.getByTestId('orbits-progress'));
    fireEvent.press(screen.getByTestId('orbits-add'));
    expect(onSelect.mock.calls).toEqual([['plan'], ['progress']]);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it.each([{ addDisabled: true }, { addBusy: true }])('blocks unavailable Add: %o', (state) => {
    const { onAdd } = setup(state);
    fireEvent.press(screen.getByTestId('orbits-add'));
    expect(onAdd).not.toHaveBeenCalled();
  });

  it.each(['warm', 'dark'] as const)('uses the %s navigation background', (name) => {
    setup({ theme: name });
    expect(StyleSheet.flatten(screen.getByTestId('orbits-navigation').props.style).backgroundColor).toBe(ORBITS_THEMES[name].background);
  });

  it('uses white for all dark labels and fixed logical artwork sizes with accessible targets', () => {
    setup({ theme: 'dark' });
    for (const label of ['Сегодня', 'План', 'Добавить', 'Успех', 'Профиль']) {
      expect(StyleSheet.flatten(screen.getByText(label).props.style).color).toBe('#FFFFFF');
    }
    for (const key of destinations) {
      expect(StyleSheet.flatten(screen.getByTestId(`orbits-${key}-artwork`).props.style)).toMatchObject({ width: 44, height: 44 });
      expect(StyleSheet.flatten(screen.getByTestId(`orbits-${key}`).props.style).minWidth).toBe(44);
    }
    expect(StyleSheet.flatten(screen.getByTestId('orbits-add-artwork').props.style)).toMatchObject({ width: 64, height: 64 });
  });

  it('keeps meaning stable across theme rerenders', () => {
    const onSelect = jest.fn();
    const onAdd = jest.fn();
    const { rerender } = render(<OrbitsNavigation activeDestination="profile" onSelect={onSelect} onAdd={onAdd} theme="warm" />);
    rerender(<OrbitsNavigation activeDestination="profile" onSelect={onSelect} onAdd={onAdd} theme="dark" />);
    expect(screen.getByTestId('orbits-profile').props.accessibilityState.selected).toBe(true);
    fireEvent.press(screen.getByTestId('orbits-profile'));
    expect(onSelect).toHaveBeenCalledWith('profile');
  });
});
