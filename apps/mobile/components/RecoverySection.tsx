import { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { RecoveryBanner, type RecoveryItemSelection } from './RecoveryBanner';
import { PartialReminderNotice } from './PartialReminderNotice';
import { useOverdueTasks, useRescheduleOverdueTasks } from '../lib/api/tasks';
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

  const [mutationError, setMutationError] = useState<string | null>(null);
  const [partialVisible, setPartialVisible] = useState(false);
  // Incrementing forces RecoveryBanner to remount, clearing local selection
  // state so a task removed by query invalidation cannot be resubmitted.
  const [bannerResetKey, setBannerResetKey] = useState(0);

  const handleConfirm = useCallback(
    (selections: RecoveryItemSelection[]) => {
      if (!recoveryData) return;
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
            setMutationError(null);
            // Reset submitted state on both ok and partial — the move committed.
            setBannerResetKey((k) => k + 1);
            setPartialVisible(data.reminderSyncStatus === 'partial');
          },
          onError: (err: unknown) => {
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
    [reschedule, recoveryData],
  );

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
});
