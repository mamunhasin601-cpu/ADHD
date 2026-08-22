import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { RecoveryBanner, type RecoveryItemSelection } from './RecoveryBanner';
import { PartialReminderNotice } from './PartialReminderNotice';
import { useOverdueTasks, useRescheduleOverdueTasks, useUndoRecovery } from '../lib/api/tasks';
import { useAuthStore } from '../stores/auth.store';
import { isValidIANATimezone, toCanonicalDateParam } from '../lib/timezone';

interface Props {
  /** The calendar date currently shown on Today. */
  selectedDate: Date;
  /**
   * Raw profile IANA timezone. May be undefined/null before the profile loads
   * or invalid if the stored value is corrupt. Never substituted with UTC or
   * the device timezone for Recovery scheduling (Task 0006C).
   */
  profileTimezone: string | null | undefined;
  /** Optional callback so Today can react to timezone validity. */
  onTimezoneInvalid?: () => void;
}

/**
 * RecoverySection — production coordinator for the Today-level Recovery flow.
 *
 * Owns:
 * - profile timezone validation (guards every formatter call);
 * - the overdue query (disabled when timezone is unusable);
 * - the reschedule mutation and its ok/partial branches;
 * - RecoveryBanner remount key so submitted selections cannot be resubmitted;
 * - the Today-level partial reminder notice that survives banner unmount.
 *
 * Extracted from TodayScreen so integration tests can render the real
 * coordination code without mounting the whole Today screen.
 */
export function RecoverySection({
  selectedDate,
  profileTimezone,
  onTimezoneInvalid,
}: Props) {
  // ── Timezone guard: validate BEFORE any formatter call ────────────────────
  const timezoneValid = useMemo(
    () => !!profileTimezone && isValidIANATimezone(profileTimezone),
    [profileTimezone],
  );

  // Safe timezone for formatter calls. Only used when timezoneValid === true.
  const tz = timezoneValid ? (profileTimezone as string) : '';

  // isToday must be answerable even when the profile timezone is unusable,
  // otherwise Recovery-only UI leaks onto historical dates (Task 0007A
  // finding 4). The canonical helper compares in the profile zone when it is
  // valid and falls back to the DEVICE calendar day otherwise — never UTC.
  // This only decides "is the user looking at today"; Recovery still refuses
  // to read or write without a valid profile timezone.
  const isToday = useMemo(
    () =>
      toCanonicalDateParam(selectedDate, profileTimezone) ===
      toCanonicalDateParam(new Date(), profileTimezone),
    [selectedDate, profileTimezone],
  );

  // Recovery query is disabled unless the timezone is valid AND we are on today.
  const { data: recoveryData, isLoading: isRecoveryLoading } = useOverdueTasks(
    selectedDate,
    timezoneValid && isToday,
    timezoneValid ? tz : undefined,
  );

  const reschedule = useRescheduleOverdueTasks(
    selectedDate,
    timezoneValid ? tz : undefined,
  );
  const undo = useUndoRecovery(selectedDate, timezoneValid ? tz : undefined);
  const owner = useAuthStore((state) => state.user?.id);
  const sessionGeneration = useAuthStore((state) => state.sessionGeneration);
  const mounted = useRef(true);
  const operation = useRef(0);
  const undoSubmissionPending = useRef(false);
  useEffect(() => () => { mounted.current = false; operation.current += 1; }, []);

  const [mutationError, setMutationError] = useState<string | null>(null);
  const [partialVisible, setPartialVisible] = useState(false);
  // Incrementing forces RecoveryBanner to remount, clearing local selection
  // state so a task removed by query invalidation cannot be resubmitted.
  const [bannerResetKey, setBannerResetKey] = useState(0);
  const [undoNotice, setUndoNotice] = useState<{
    id: string; expiresAt: number; status: 'ready' | 'success' | 'expired' | 'stale' | 'error'; partial: boolean;
  } | null>(null);
  useEffect(() => {
    if (!undoNotice || undoNotice.status !== 'ready') return;
    const delay = Math.max(0, undoNotice.expiresAt - Date.now());
    const timer = setTimeout(() => setUndoNotice((value) => value?.id === undoNotice.id ? { ...value, status: 'expired' } : value), delay);
    return () => clearTimeout(timer);
  }, [undoNotice?.id, undoNotice?.status, undoNotice?.expiresAt]);

  const handleConfirm = useCallback(
    (selections: RecoveryItemSelection[]) => {
      if (!recoveryData || reschedule.isPending) return;
      undoSubmissionPending.current = false;
      const identity = ++operation.current;
      const operationOwner = owner;
      const operationSession = sessionGeneration;
      const owns = () => mounted.current && operation.current === identity &&
        useAuthStore.getState().user?.id === operationOwner &&
        useAuthStore.getState().sessionGeneration === operationSession;
      setMutationError(null);
      reschedule.mutate(
        {
          items: selections.map((s) => ({
            taskId: s.taskId,
            targetStartTime: s.destination === 'inbox' ? null : s.destination,
          })),
        },
        {
          onSuccess: (data) => {
            if (!owns()) return;
            setMutationError(null);
            // Reset submitted state on both ok and partial — the move committed.
            setBannerResetKey((k) => k + 1);
            setPartialVisible(data.reminderSyncStatus === 'partial');
            if (data.undoId && data.undoExpiresAt) {
              setUndoNotice({ id: data.undoId, expiresAt: new Date(data.undoExpiresAt).getTime(), status: 'ready', partial: data.reminderSyncStatus === 'partial' });
            }
          },
          onError: (err: unknown) => {
            if (!owns()) return;
            const axiosError = err as { response?: { status?: number } };
            if (axiosError.response?.status === 409) {
              setMutationError(
                'Некоторые задачи изменились. Список обновлён — выберите снова.',
              );
            } else {
              setMutationError(
                'Не удалось перенести задачи. Проверьте соединение и попробуйте снова.',
              );
            }
          },
        },
      );
    },
    [reschedule, recoveryData, owner, sessionGeneration],
  );

  const handleUndo = useCallback(() => {
    if (!undoNotice || undoNotice.status !== 'ready' || undo.isPending || undoSubmissionPending.current) return;
    undoSubmissionPending.current = true;
    const identity = ++operation.current;
    const id = undoNotice.id;
    const operationOwner = owner;
    const operationSession = sessionGeneration;
    const owns = () => mounted.current && operation.current === identity &&
      useAuthStore.getState().user?.id === operationOwner &&
      useAuthStore.getState().sessionGeneration === operationSession;
    undo.mutate(id, {
      onSuccess: (data) => {
        undoSubmissionPending.current = false;
        if (!owns()) return;
        setUndoNotice((value) => value?.id === id ? { ...value, status: 'success', partial: data.reminderSyncStatus === 'partial' } : value);
        setPartialVisible(data.reminderSyncStatus === 'partial');
      },
      onError: (error: unknown) => {
        undoSubmissionPending.current = false;
        if (!owns()) return;
        const code = (error as { response?: { data?: { code?: string } } }).response?.data?.code;
        const status = code === 'RECOVERY_UNDO_EXPIRED' ? 'expired' : code === 'RECOVERY_UNDO_STALE' ? 'stale' : 'error';
        setUndoNotice((value) => value?.id === id ? { ...value, status } : value);
      },
    });
  }, [undo, undoNotice, owner, sessionGeneration]);

  const overdueTasks = recoveryData?.tasks ?? [];
  const hasOverdueTasks = isToday && overdueTasks.length > 0;

  // ── Today-only guard: MUST come before the timezone state ─────────────────
  // Recovery is a Today-only affordance. Historical and future dates render
  // nothing at all — including the timezone-unavailable state, which used to
  // leak onto every past date whenever the profile timezone was missing or
  // invalid (Task 0007A finding 4).
  if (!isToday) {
    return null;
  }

  // ── Invalid/unavailable timezone on Today: neutral recoverable state ──────
  if (!timezoneValid) {
    return (
      <View testID="recovery-timezone-unavailable" style={styles.tzState}>
        <Text style={styles.tzTitle}>Часовой пояс не определён</Text>
        <Text style={styles.tzBody}>
          Незавершённые задачи не показаны, потому что не удалось определить ваш
          часовой пояс. Проверьте его в настройках профиля.
        </Text>
        {onTimezoneInvalid && (
          <Pressable
            testID="recovery-timezone-action"
            style={styles.tzAction}
            onPress={onTimezoneInvalid}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Открыть настройки профиля"
          >
            <Text style={styles.tzActionText}>Настройки профиля</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <>
      {/* Today-level notice — survives RecoveryBanner unmount */}
      {partialVisible && (
        <PartialReminderNotice onDismiss={() => setPartialVisible(false)} />
      )}

      {undoNotice && (
        <View testID="recovery-undo-confirmation" style={styles.undoNotice} accessible accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Text style={styles.undoText}>
            {undoNotice.status === 'ready' && 'Задачи перенесены. Можно спокойно отменить изменение.'}
            {undoNotice.status === 'success' && 'Перенос отменён. Задачи возвращены на прежнее место.'}
            {undoNotice.status === 'expired' && 'Время отмены закончилось. Текущие задачи не изменены.'}
            {undoNotice.status === 'stale' && 'Задача уже изменилась, поэтому отмена не применена.'}
            {undoNotice.status === 'error' && 'Не удалось отменить перенос. Текущие задачи не изменены.'}
          </Text>
          {undoNotice.status === 'ready' && (
            <Pressable testID="recovery-undo-button" onPress={handleUndo} disabled={undo.isPending}
              accessible accessibilityRole="button" accessibilityLabel="Отменить перенос задач"
              accessibilityState={{ disabled: undo.isPending, busy: undo.isPending }} style={styles.undoButton}>
              <Text style={styles.undoButtonText}>{undo.isPending ? 'Отменяем…' : 'Отменить'}</Text>
            </Pressable>
          )}
        </View>
      )}

      {!isRecoveryLoading && hasOverdueTasks && recoveryData && (
        <RecoveryBanner
          key={bannerResetKey}
          overdueTasks={overdueTasks}
          userTimezone={recoveryData.userTimezone}
          onConfirm={handleConfirm}
          isConfirming={reschedule.isPending}
          mutationError={mutationError}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  tzState: {
    marginHorizontal: 20,
    marginVertical: 8,
    padding: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tzTitle: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 4 },
  tzBody: { fontSize: 12, color: '#6B7280', lineHeight: 18 },
  tzAction: {
    marginTop: 12,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  tzActionText: { fontSize: 14, color: '#6B5BFC', fontWeight: '600' },
  undoNotice: { marginHorizontal: 20, marginVertical: 8, padding: 14, borderRadius: 10, backgroundColor: '#F5F3FF', borderWidth: 1, borderColor: '#C4B5FD' },
  undoText: { color: '#374151', fontSize: 14, lineHeight: 20 },
  undoButton: { minHeight: 44, marginTop: 8, paddingHorizontal: 16, justifyContent: 'center', alignSelf: 'flex-start' },
  undoButtonText: { color: '#6B5BFC', fontWeight: '700', fontSize: 15 },
});
