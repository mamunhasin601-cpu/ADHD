import { View, Text, StyleSheet, Pressable } from 'react-native';

interface Props {
  /** Called when the user dismisses the notice. */
  onDismiss: () => void;
}

/**
 * Today-level notice shown when a recovery reschedule succeeded but some
 * reminders could not be updated.
 *
 * Mounted in Today (not inside RecoveryBanner) so it survives component unmount
 * when the last overdue task leaves the query.
 * Copy is neutral, actionable, and free of task titles or IDs.
 */
export function PartialReminderNotice({ onDismiss }: Props) {
  return (
    <View
      testID="partial-reminder-notice"
      style={styles.container}
      accessible
      accessibilityRole="alert"
      accessibilityLabel="Задачи перенесены. Некоторые напоминания не удалось обновить. Откройте перенесённые задачи и сохраните время заново."
    >
      <View style={styles.content}>
        <Text style={styles.title}>Задачи перенесены</Text>
        <Text style={styles.body}>
          Некоторые напоминания не удалось обновить. Откройте перенесённые
          задачи и сохраните время заново, если нужно напоминание.
        </Text>
      </View>
      <Pressable
        testID="partial-reminder-dismiss"
        style={styles.dismiss}
        onPress={onDismiss}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Закрыть уведомление"
      >
        <Text style={styles.dismissText}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 20,
    marginVertical: 6,
    padding: 12,
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  content: { flex: 1, marginRight: 8 },
  title: { fontSize: 13, fontWeight: '600', color: '#92400E', marginBottom: 2 },
  body: { fontSize: 12, color: '#78350F', lineHeight: 18 },
  dismiss: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissText: { fontSize: 16, color: '#92400E' },
});
