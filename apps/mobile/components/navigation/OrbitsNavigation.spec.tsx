import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { OrbitsNavigation, orbitsLabelScalePolicy } from './OrbitsNavigation';
import { ORBITS_NAVIGATION_ASSETS } from './orbits-assets';
import { contrastRatio, ORBITS_THEMES, OrbitsThemeProvider } from '../../theme/orbits';

const destinations = ['today', 'plan', 'progress', 'profile'] as const;

function setup(overrides: Partial<React.ComponentProps<typeof OrbitsNavigation>> = {}) {
  const onSelect = jest.fn();
  const onAdd = jest.fn();
  render(<OrbitsNavigation activeDestination="today" onSelect={onSelect} onAdd={onAdd} {...overrides} />);
  return { onSelect, onAdd };
}

describe('OrbitsNavigation', () => {
  it('caps only the combined extreme display fallback', () => {
    expect(orbitsLabelScalePolicy(320, 2)).toEqual({ maximum: 1.2, fit: true });
    expect(orbitsLabelScalePolicy(320, 1.6)).toEqual({ maximum: 1.6, fit: false });
    expect(orbitsLabelScalePolicy(400, 2)).toEqual({ maximum: 1.6, fit: false });
  });
  it.each([0, 1, 5, 9, 10, 27])('renders only the Plan badge for count %s with the full accessible count', (count) => {
    const { onSelect } = setup({ recoveryCount: count });
    const badge = screen.queryByTestId('orbits-plan-recovery-badge', { includeHiddenElements: true });
    expect(screen.getByTestId('orbits-plan').props.accessibilityLabel).toBe(count ? `План, ${count} задач, к которым можно вернуться` : 'План');
    if (count) {
      expect(badge).toBeTruthy();
      expect(badge!.props.pointerEvents).toBe('none');
      expect(badge!.props.accessible).toBe(false);
      expect(StyleSheet.flatten(badge!.props.style).position).toBe('absolute');
      expect(screen.getByText(count > 9 ? '9+' : String(count), { includeHiddenElements: true })).toBeTruthy();
      fireEvent.press(badge!);
    } else expect(badge).toBeNull();
    if (!count) fireEvent.press(screen.getByTestId('orbits-plan'));
    expect(onSelect.mock.calls).toEqual([['plan']]);
    for (const [key, label] of [['today', 'Сегодня'], ['progress', 'Успех'], ['profile', 'Профиль']]) {
      expect(screen.getByTestId(`orbits-${key}`).props.accessibilityLabel).toBe(label);
      expect(screen.queryByTestId(`orbits-${key}-recovery-badge`, { includeHiddenElements: true })).toBeNull();
    }
  });

  it('updates the Recovery accent with the theme and removes a zero badge without changing targets or artwork', () => {
    const onSelect = jest.fn();
    const onAdd = jest.fn();
    const tree = (theme: 'warm' | 'dark', count: number) => <OrbitsThemeProvider theme={theme}><OrbitsNavigation activeDestination="plan" onSelect={onSelect} onAdd={onAdd} recoveryCount={count} /></OrbitsThemeProvider>;
    const { rerender } = render(tree('warm', 3));
    const targetStyle = StyleSheet.flatten(screen.getByTestId('orbits-plan').props.style);
    const artworkStyle = StyleSheet.flatten(screen.getByTestId('orbits-plan-artwork').props.style);
    for (const theme of ['warm', 'dark'] as const) {
      rerender(tree(theme, 3));
      expect(StyleSheet.flatten(screen.getByTestId('orbits-plan-recovery-badge', { includeHiddenElements: true }).props.style)).toMatchObject({ backgroundColor: ORBITS_THEMES[theme].rewardSoft, borderColor: ORBITS_THEMES[theme].rewardPrimary });
      expect(StyleSheet.flatten(screen.getByText('3', { includeHiddenElements: true }).props.style).color).toBe(ORBITS_THEMES[theme].rewardPrimary);
      expect(contrastRatio(ORBITS_THEMES[theme].rewardPrimary, ORBITS_THEMES[theme].rewardSoft)).toBeGreaterThanOrEqual(4.5);
      const { backgroundColor, borderColor, ...geometry } = StyleSheet.flatten(screen.getByTestId('orbits-plan').props.style);
      const { backgroundColor: initialBackground, borderColor: initialBorder, ...initialGeometry } = targetStyle;
      expect(geometry).toEqual(initialGeometry);
      expect(StyleSheet.flatten(screen.getByTestId('orbits-plan-artwork').props.style)).toEqual(artworkStyle);
    }
    rerender(tree('dark', 0));
    expect(screen.queryByTestId('orbits-plan-recovery-badge', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('orbits-plan').props.accessibilityLabel).toBe('План');
  });

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

  it('keeps every destination label whole and lets the bar grow for large text and safe area', () => {
    render(<OrbitsNavigation activeDestination="today" onSelect={jest.fn()} onAdd={jest.fn()} bottomInset={28} />);
    for (const label of ['Сегодня', 'План', 'Добавить', 'Успех', 'Профиль']) {
      expect(screen.getByText(label).props).toMatchObject({
        numberOfLines: 1,
        maxFontSizeMultiplier: 1.6,
        android_hyphenationFrequency: 'none',
      });
    }
    expect(StyleSheet.flatten(screen.getByTestId('orbits-navigation').props.style).paddingBottom).toBe(34);
    expect(StyleSheet.flatten(screen.getByTestId('orbits-navigation').props.style).height).toBeUndefined();
  });

  it('keeps every destination label whole and lets the bar grow for large text and safe area', () => {
    render(<OrbitsNavigation activeDestination="today" onSelect={jest.fn()} onAdd={jest.fn()} bottomInset={28} />);
    for (const label of ['Сегодня', 'План', 'Добавить', 'Успех', 'Профиль']) {
      expect(screen.getByText(label).props).toMatchObject({
        numberOfLines: 1,
        maxFontSizeMultiplier: 1.6,
        android_hyphenationFrequency: 'none',
      });
    }
    expect(StyleSheet.flatten(screen.getByTestId('orbits-navigation').props.style).paddingBottom).toBe(34);
    expect(StyleSheet.flatten(screen.getByTestId('orbits-navigation').props.style).height).toBeUndefined();
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
