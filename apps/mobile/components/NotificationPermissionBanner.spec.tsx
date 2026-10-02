/**
 * NotificationPermissionBanner component tests (Task 0011C).
 *
 * Verifies:
 *  - Renders neutral copy text (no alarming language)
 *  - Renders "Открыть настройки" action button
 *  - Calls openNotificationSettings when button is pressed
 *  - Calls onSettingsOpened callback after settings opened
 *  - Does not throw when onSettingsOpened is undefined
 */

jest.mock('../lib/notification-permission', () => ({
  openNotificationSettings: jest.fn(),
}));

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { NotificationPermissionBanner } from './NotificationPermissionBanner';
import { openNotificationSettings } from '../lib/notification-permission';
import { ORBITS_THEMES, OrbitsThemeProvider } from '../theme/orbits';

const mockOpenSettings = openNotificationSettings as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockOpenSettings.mockResolvedValue(undefined);
});

describe('NotificationPermissionBanner', () => {
  it('renders the neutral informational text', () => {
    const { getByTestId } = render(<NotificationPermissionBanner />);

    const text = getByTestId('notification-permission-text');
    expect(text.props.children).toMatch(/уведомления/i);
    // Must not contain alarming language
    expect(text.props.children).not.toMatch(/ошибка|критич|блок/i);
  });

  it('renders the settings action button', () => {
    const { getByTestId } = render(<NotificationPermissionBanner />);

    const button = getByTestId('notification-permission-settings-button');
    expect(button).toBeTruthy();
  });

  it('button label says "Открыть настройки"', () => {
    const { getByText } = render(<NotificationPermissionBanner />);
    expect(getByText('Открыть настройки')).toBeTruthy();
  });

  it('calls openNotificationSettings when button is pressed', async () => {
    const { getByTestId } = render(<NotificationPermissionBanner />);

    await act(async () => {
      fireEvent.press(getByTestId('notification-permission-settings-button'));
    });

    expect(mockOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('calls onSettingsOpened callback after opening settings', async () => {
    const onSettingsOpened = jest.fn();
    const { getByTestId } = render(
      <NotificationPermissionBanner onSettingsOpened={onSettingsOpened} />,
    );

    await act(async () => {
      fireEvent.press(getByTestId('notification-permission-settings-button'));
    });

    expect(onSettingsOpened).toHaveBeenCalledTimes(1);
  });

  it('does not throw when onSettingsOpened is not provided', async () => {
    const { getByTestId } = render(<NotificationPermissionBanner />);

    await expect(
      act(async () => {
        fireEvent.press(getByTestId('notification-permission-settings-button'));
      }),
    ).resolves.not.toThrow();
  });

  it('has a testID on the container for accessibility testing', () => {
    const { getByTestId } = render(<NotificationPermissionBanner />);
    expect(getByTestId('notification-permission-banner')).toBeTruthy();
  });

  it.each(['warm', 'dark'] as const)('uses semantic %s tokens', (name) => {
    const view = render(<OrbitsThemeProvider theme={name}><NotificationPermissionBanner /></OrbitsThemeProvider>);
    const theme = ORBITS_THEMES[name];
    expect(StyleSheet.flatten(view.getByTestId('notification-permission-banner').props.style)).toMatchObject({
      backgroundColor: theme.rewardSoft,
      borderBottomColor: theme.rewardPrimary,
    });
    expect(StyleSheet.flatten(view.getByTestId('notification-permission-text').props.style).color).toBe(theme.textPrimary);
    expect(StyleSheet.flatten(view.getByTestId('notification-permission-settings-button').props.style)).toMatchObject({
      backgroundColor: theme.activeSurface,
      borderColor: theme.activeBorder,
    });
  });
});
