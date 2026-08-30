import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNotificationLifecycle } from '../lib/notification-lifecycle';
import { useOrbitsTheme } from '../theme/orbits';

export function NotificationInvitation() {
  const theme = useOrbitsTheme();
  const { busy, error, requestPermission, deferInvitation } = useNotificationLifecycle();
  return (
    <View style={[styles.card, { backgroundColor: theme.activeSurface }]} accessibilityLabel="Предложение настроить напоминания">
      <Text style={[styles.title, { color: theme.activeSurfaceText }]}>Хотите получать напоминания?</Text>
      <Text style={[styles.body, { color: theme.textSecondary }]}>Focus сможет напомнить о запланированном действии. Это можно изменить позже.</Text>
      {error && <Text accessibilityRole="alert" style={[styles.error, { color: theme.errorPrimary }]}>{error}</Text>}
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Включить напоминания" accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={requestPermission} style={[styles.primary, { backgroundColor: theme.brand }, busy && styles.disabled]}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Включить напоминания</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={deferInvitation} style={styles.secondary}>
          <Text style={[styles.secondaryText, { color: theme.brand }]}>Не сейчас</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 20, marginBottom: 12, padding: 16, borderRadius: 14, backgroundColor: '#F3F1FF' },
  title: { color: '#211D2E', fontSize: 17, fontWeight: '700', marginBottom: 6 },
  body: { color: '#4B5563', fontSize: 15, lineHeight: 21 },
  error: { color: '#9B3A3A', marginTop: 8, lineHeight: 19 },
  actions: { marginTop: 14, gap: 8 },
  primary: { minHeight: 44, borderRadius: 10, backgroundColor: '#6B5BFC', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  primaryText: { color: '#FFFFFF', fontWeight: '700', textAlign: 'center' },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#5B4BE7', fontWeight: '600' },
  disabled: { opacity: 0.6 },
});
