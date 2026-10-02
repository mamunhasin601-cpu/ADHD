import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import PaywallScreen from '../app/paywall';
import { usePlanInfo } from '../lib/api/plan';
import { StyleSheet } from 'react-native';
import { ORBITS_THEMES, OrbitsThemeProvider } from '../theme/orbits';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }) }));
jest.mock('../lib/api/plan', () => ({ usePlanInfo: jest.fn() }));
jest.mock('expo-status-bar', () => { const React = require('react'); const { View } = require('react-native'); return { StatusBar: (props: any) => React.createElement(View, { testID: 'paywall-status-bar', ...props }) }; });

const mockUsePlanInfo = usePlanInfo as jest.Mock;

describe('honest Free limit screen', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockUsePlanInfo.mockReturnValue({
      data: { plan: 'FREE', isPro: false, proExpiresAt: null, usage: { activeTasks: 50, limit: 50 } },
      isLoading: false,
      isError: false,
    });
  });

  it('explains the accurate Free limit and offers a calm path back', () => {
    render(<PaywallScreen />);
    expect(screen.getByText('В плане Free можно иметь до 50 активных задач.')).toBeTruthy();
    expect(screen.getByText('50 из 50 активных задач использовано')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Вернуться к задачам' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('contains no pricing, trial, purchase success, upgrade call, or unavailable feature promises', () => {
    const { toJSON } = render(<PaywallScreen />);
    const copy = JSON.stringify(toJSON());
    expect(copy).not.toMatch(/\/plan\/upgrade|299|1 990|7 дней|Добро пожаловать|подписк|Pro-фич|Недельный вид|Умные напоминания|Синхронизация устройств/i);
  });

  it('shows loading without a success or activation state', () => {
    mockUsePlanInfo.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(<PaywallScreen />);
    expect(screen.getByText('Проверяем количество задач…')).toBeTruthy();
    expect(screen.queryByText(/успеш|активирован|Pro/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Вернуться к задачам' })).toBeTruthy();
  });

  it('states that data is unchanged on load error and still permits leaving', () => {
    mockUsePlanInfo.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<PaywallScreen />);
    expect(screen.getByText('Не удалось загрузить текущее количество. Ваш план и задачи не изменились.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Вернуться к задачам' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it.each(['warm', 'dark'] as const)('uses %s tokens for the limit, loading/error canvas, and StatusBar', (name) => {
    const view = render(<OrbitsThemeProvider theme={name}><PaywallScreen /></OrbitsThemeProvider>);
    const theme = ORBITS_THEMES[name];
    expect(StyleSheet.flatten(view.getByTestId('paywall-screen').props.style).backgroundColor).toBe(theme.background);
    expect(StyleSheet.flatten(view.getByTestId('paywall-card').props.style)).toMatchObject({ backgroundColor: theme.surfacePrimary, borderColor: theme.borderSubtle });
    expect(view.getByTestId('paywall-status-bar').props.style).toBe(name === 'dark' ? 'light' : 'dark');
  });
});
