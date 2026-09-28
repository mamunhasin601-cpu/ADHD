import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useUndoRecovery } from '../lib/api/tasks';
import { useRecoveryUndoHistory, type RecoveryUndoEntry } from '../lib/recovery-undo-history';
import { useAuthStore } from '../stores/auth.store';
import { useOrbitsTheme } from '../theme/orbits';

function movedTasksLabel(count: number): string {
  const remainder100 = count % 100;
  const remainder10 = count % 10;
  if (remainder100 >= 11 && remainder100 <= 14) return `${count} задач перенесено`;
  if (remainder10 === 1) return `${count} задача перенесена`;
  if (remainder10 >= 2 && remainder10 <= 4) return `${count} задачи перенесены`;
  return `${count} задач перенесено`;
}

function expiryLabel(entry: RecoveryUndoEntry): string {
  return `Отмена доступна до ${new Date(entry.expiresAt).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export function PlanUndoHistory() {
  const theme = useOrbitsTheme();
  const userId = useAuthStore((state) => state.user?.id);
  const profileTimezone = useAuthStore((state) => state.user?.timezone);
  const entries = useRecoveryUndoHistory((state) => state.entries);
  const hydrate = useRecoveryUndoHistory((state) => state.hydrate);
  const remove = useRecoveryUndoHistory((state) => state.remove);
  const prune = useRecoveryUndoHistory((state) => state.prune);
  const undo = useUndoRecovery(new Date(), profileTimezone);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    void hydrate(userId);
    prune(userId);
    const timer = setInterval(() => prune(userId), 30_000);
    return () => clearInterval(timer);
  }, [hydrate, prune, userId]);

  const availableEntries = useMemo(
    () => entries.filter((entry) => entry.userId === userId && entry.expiresAt > Date.now()),
    [entries, userId],
  );

  if (!userId || availableEntries.length === 0) return null;

  function handleUndo(entry: RecoveryUndoEntry) {
    if (!userId || pendingId || undo.isPending) return;
    setPendingId(entry.id);
    setResultMessage(null);
    undo.mutate(entry.id, {
      onSuccess: () => {
        remove(userId, entry.id);
        setPendingId(null);
        setResultMessage('Перенос отменён. Задача возвращена на прежнее место.');
      },
      onError: (error: unknown) => {
        const code = (error as { response?: { data?: { code?: string } } }).response?.data?.code;
        if (code === 'RECOVERY_UNDO_EXPIRED' || code === 'RECOVERY_UNDO_STALE') {
          remove(userId, entry.id);
          setResultMessage(
            code === 'RECOVERY_UNDO_EXPIRED'
              ? 'Время отмены закончилось.'
              : 'Задача уже изменилась, поэтому отмена недоступна.',
          );
        } else {
          setResultMessage('Не удалось отменить перенос. Проверьте соединение и попробуйте снова.');
        }
        setPendingId(null);
      },
    });
  }

  return (
    <View
      testID="plan-undo-history"
      style={[styles.section, { backgroundColor: theme.surfacePrimary, borderColor: theme.borderSubtle }]}
    >
      <Text style={[styles.title, { color: theme.textPrimary }]}>Недавние изменения</Text>
      <Text style={[styles.copy, { color: theme.textSecondary }]}>Здесь можно отменить недавний перенос.</Text>

      {availableEntries.map((entry) => {
        const isPending = pendingId === entry.id;
        return (
          <View key={entry.id} testID={`plan-undo-${entry.id}`} style={[styles.row, { borderTopColor: theme.borderSubtle }]}>
            <View style={styles.rowCopy}>
              <Text style={[styles.rowTitle, { color: theme.textPrimary }]}>{movedTasksLabel(entry.taskCount)}</Text>
              <Text style={[styles.rowMeta, { color: theme.textSecondary }]}>{expiryLabel(entry)}</Text>
            </View>
            <Pressable
              testID={`plan-undo-button-${entry.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Отменить перенос. ${movedTasksLabel(entry.taskCount)}`}
              accessibilityHint="Возвращает задачу на прежнее место"
              accessibilityState={{ disabled: Boolean(pendingId), busy: isPending }}
              disabled={Boolean(pendingId)}
              onPress={() => handleUndo(entry)}
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: pressed ? theme.brandPressed : theme.activeSurface,
                  borderColor: theme.activeBorder,
                },
              ]}
            >
              <Text style={[styles.buttonText, { color: isPending ? theme.textSecondary : theme.activeSurfaceText }]}>
                {isPending ? 'Отменяем…' : 'Отменить'}
              </Text>
            </Pressable>
          </View>
        );
      })}

      {resultMessage ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.result, { color: theme.textSecondary }]}> 
          {resultMessage}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 18, padding: 18, borderRadius: 18, borderWidth: 1 },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  copy: { marginTop: 3, fontSize: 14, lineHeight: 20 },
  row: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowCopy: { flex: 1 },
  rowTitle: { fontSize: 15, lineHeight: 21, fontWeight: '700' },
  rowMeta: { marginTop: 2, fontSize: 12, lineHeight: 17 },
  button: { minHeight: 44, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
  result: { marginTop: 12, fontSize: 13, lineHeight: 18 },
});
