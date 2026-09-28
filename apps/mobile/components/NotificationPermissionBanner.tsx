/**
 * NotificationPermissionBanner (Task 0011B blocker 2).
 *
 * Shows a neutral, non-blocking banner when notification permission is denied.
 * Provides an explicit user action path: "Open Settings" → user enables notifications
 * in OS settings → app resumes and refreshes permission state via AppState listener.
 *
 * This component does NOT block task CRUD — it renders beneath the main content
 * and is dismissed automatically when permission is granted.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { openNotificationSettings } from '../lib/notification-permission';
import { useOrbitsTheme } from '../theme/orbits';

interface Props {
  /** Called when the user taps "Open Settings" to trigger a refresh on return. */
  onSettingsOpened?: () => void;
}

export function NotificationPermissionBanner({ onSettingsOpened }: Props) {
  const theme = useOrbitsTheme();
  const handlePress = async () => {
    await openNotificationSettings();
    onSettingsOpened?.();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.rewardSoft, borderBottomColor: theme.rewardPrimary }]} testID="notification-permission-banner">
      <Text style={[styles.text, { color: theme.textPrimary }]} testID="notification-permission-text">
        Уведомления выключены — напоминания не будут работать
      </Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.activeSurface, borderColor: theme.activeBorder }]}
        onPress={handlePress}
        testID="notification-permission-settings-button"
      >
        <Text style={[styles.buttonText, { color: theme.activeSurfaceText }]}>Открыть настройки</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  text: {
    flex: 1,
    fontSize: 13,
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 6,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
