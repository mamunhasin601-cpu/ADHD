import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Task } from '@focus/shared-types';
import {
  pickerDateToLocalString,
  pickerTimeToLocalFields,
  localDateTimeToInstant,
  validateWallClock,
  isValidIANATimezone,
  addCalendarDays,
  todayLocalDateString,
  isAfterReference,
  formatDestinationLabel,
} from '../lib/timezone';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Explicit destination for a recovery task.
 * 'inbox'    → targetStartTime: null
 * ISO string → targetStartTime: future UTC instant interpreted in profile tz
 * 'today' alias is intentionally absent. No silent default.
 */
export type RecoveryDestination = 'inbox' | string;

export interface RecoveryItemSelection {
  taskId: string;
  destination: RecoveryDestination;
}

interface Props {
  overdueTasks: Task[];
  /** IANA timezone from the server — the ONLY timezone used for all display/conversion. */
  userTimezone: string;
  /** Called on confirm. Caller executes the mutation; this component never mutates. */
  onConfirm: (selections: RecoveryItemSelection[]) => void;
  isConfirming?: boolean;
  /** Non-null for mutation errors (409, network). Partial sync is NOT an error. */
  mutationError?: string | null;
}

type PickerState =
  | { taskId: string; phase: 'date' }
  | { taskId: string; phase: 'time'; dateStr: string };

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function RecoveryBanner({
  overdueTasks,
  userTimezone,
  onConfirm,
  isConfirming = false,
  mutationError = null,
}: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [destinations, setDestinations] = useState<Record<string, RecoveryDestination | null>>({});
  // DST error per task: taskId → error message if nonexistent wall-clock time
  const [dstErrors, setDstErrors] = useState<Record<string, string | null>>({});
  const [pickerState, setPickerState] = useState<PickerState | null>(null);

  // ── Timezone guard ────────────────────────────────────────────────────────

  const timezoneValid = isValidIANATimezone(userTimezone);

  // ── Sheet open/close ──────────────────────────────────────────────────────

  const openSheet = useCallback(() => {
    setSelectedIds(new Set());
    setDestinations({});
    setDstErrors({});
    setPickerState(null);
    setSheetOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    setSelectedIds(new Set());
    setDestinations({});
    setDstErrors({});
    setPickerState(null);
  }, []);

  // ── Selection ─────────────────────────────────────────────────────────────

  const toggleTask = useCallback((taskId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
        setDestinations((d) => { const c = { ...d }; delete c[taskId]; return c; });
        setDstErrors((e) => { const c = { ...e }; delete c[taskId]; return c; });
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  // ── Destination ───────────────────────────────────────────────────────────

  const setInbox = useCallback((taskId: string) => {
    setPickerState(null);
    setDstErrors((prev) => ({ ...prev, [taskId]: null }));
    setDestinations((prev) => ({ ...prev, [taskId]: 'inbox' }));
  }, []);

  const openDatePicker = useCallback((taskId: string) => {
    setDstErrors((prev) => ({ ...prev, [taskId]: null }));
    setPickerState({ taskId, phase: 'date' });
  }, []);

  // ── Picker handlers ───────────────────────────────────────────────────────

  const handleDatePickerChange = useCallback(
    (_event: DateTimePickerEvent, date?: Date) => {
      if (!pickerState || pickerState.phase !== 'date') return;
      const taskId = pickerState.taskId;
      if (_event.type === 'dismissed' || !date) {
        setPickerState(null);
        return;
      }
      // Read device-local calendar fields — exactly what the user saw on the picker.
      const dateStr = pickerDateToLocalString(date);
      setPickerState({ taskId, phase: 'time', dateStr });
    },
    [pickerState],
  );

  const handleTimePickerChange = useCallback(
    (_event: DateTimePickerEvent, date?: Date) => {
      if (!pickerState || pickerState.phase !== 'time') return;
      const { taskId, dateStr } = pickerState;
      if (_event.type === 'dismissed' || !date) {
        setPickerState(null);
        return;
      }
      // Read device-local clock fields — exactly what the user saw on the picker.
      // Interpret those same fields in the profile timezone (not device tz).
      const { hours, minutes } = pickerTimeToLocalFields(date);
      const validation = validateWallClock(dateStr, hours, minutes, userTimezone);

      setPickerState(null);

      if (!validation.valid) {
        // Spring-forward gap: the requested wall-clock time does not exist.
        setDstErrors((prev) => ({
          ...prev,
          [taskId]:
            `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')} ` +
            `не существует в этот день (переход на летнее время). ` +
            `Выберите другое время.`,
        }));
        setDestinations((prev) => ({ ...prev, [taskId]: null }));
        return;
      }

      setDstErrors((prev) => ({ ...prev, [taskId]: null }));
      setDestinations((prev) => ({ ...prev, [taskId]: validation.instant.toISOString() }));
    },
    [pickerState, userTimezone],
  );

  // ── Validation ────────────────────────────────────────────────────────────

  const now = new Date();

  function isValidDestination(dest: RecoveryDestination | null | undefined, taskId: string): boolean {
    if (dstErrors[taskId]) return false;
    if (!dest) return false;
    if (dest === 'inbox') return true;
    const d = new Date(dest);
    return !isNaN(d.getTime()) && isAfterReference(d, now);
  }

  const allValid =
    selectedIds.size > 0 &&
    Array.from(selectedIds).every((id) => isValidDestination(destinations[id], id));

  const canConfirm = allValid && !isConfirming;

  // ── Confirm ───────────────────────────────────────────────────────────────

  const handleConfirm = useCallback(() => {
    if (!allValid) return;
    onConfirm(
      Array.from(selectedIds).map((taskId) => ({
        taskId,
        destination: destinations[taskId] as RecoveryDestination,
      })),
    );
  }, [allValid, selectedIds, destinations, onConfirm]);

  // ── Display helpers ───────────────────────────────────────────────────────

  function formatOverdueDate(startTime: Date | string | null): string {
    if (!startTime || !timezoneValid) return '';
    try {
      return formatDestinationLabel(new Date(startTime), userTimezone);
    } catch {
      return '';
    }
  }

  function getDestinationPreview(
    dest: RecoveryDestination | null | undefined,
    taskId: string,
  ): { text: string; warn: boolean } {
    const dstErr = dstErrors[taskId];
    if (dstErr) return { text: dstErr, warn: true };
    if (!dest) return { text: 'Выберите, куда перенести', warn: false };
    if (dest === 'inbox') return { text: '→ В «Мысли»', warn: false };
    try {
      const d = new Date(dest);
      if (isNaN(d.getTime())) return { text: 'Недопустимое время', warn: true };
      if (!isAfterReference(d, now)) {
        return { text: `→ ${formatDestinationLabel(d, userTimezone)} (уже прошло)`, warn: true };
      }
      return { text: `→ ${formatDestinationLabel(d, userTimezone)}`, warn: false };
    } catch {
      return { text: 'Ошибка формата времени', warn: true };
    }
  }

  const todayStr = timezoneValid ? todayLocalDateString(userTimezone) : '';
  const minimumPickerDate = todayStr
    ? new Date(Date.parse(`${todayStr}T00:00:00Z`))
    : new Date();
  const pickerDateInitial = new Date(
    Date.parse(`${addCalendarDays(todayStr || '2000-01-01', 0)}T12:00:00Z`),
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Pressable
        testID="recovery-banner"
        style={styles.banner}
        onPress={openSheet}
        accessible
        accessibilityRole="button"
        accessibilityLabel={
          `Незавершённые задачи: ${overdueTasks.length}. ` +
          `Нажмите, чтобы выбрать, что делать дальше.`
        }
      >
        <View style={styles.bannerLeft}>
          <Text style={styles.bannerIcon}>↩</Text>
          <View style={styles.bannerTextCol}>
            <Text style={styles.bannerTitle}>
              {overdueTasks.length === 1
                ? '1 незавершённая задача'
                : `${overdueTasks.length} незавершённых задачи`}
            </Text>
            <Text style={styles.bannerSubtitle}>
              Нажмите, чтобы выбрать, что делать дальше
            </Text>
          </View>
        </View>
        <Text style={styles.bannerChevron}>›</Text>
      </Pressable>

      <Modal
        testID="recovery-sheet"
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={closeSheet}
        accessible
        accessibilityViewIsModal
      >
        <SafeAreaView style={styles.overlay}>
          <View style={styles.sheet}>

            {/* Invalid timezone — neutral retryable error */}
            {!timezoneValid ? (
              <View style={styles.timezoneError} testID="timezone-error-state">
                <Text style={styles.timezoneErrorText}>
                  Не удалось определить ваш часовой пояс.
                  Обновите приложение или проверьте настройки профиля.
                </Text>
                <Pressable
                  testID="timezone-error-close"
                  style={styles.timezoneErrorClose}
                  onPress={closeSheet}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel="Закрыть"
                >
                  <Text style={styles.timezoneErrorCloseText}>Закрыть</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>Незавершённые задачи</Text>
                  <Text style={styles.sheetSubtitle}>
                    Выберите задачи и куда их перенести.
                    Неотмеченные задачи останутся без изменений.
                  </Text>
                </View>

                <ScrollView
                  style={styles.taskList}
                  contentContainerStyle={styles.taskListContent}
                  showsVerticalScrollIndicator={false}
                >
                  {overdueTasks.map((task) => {
                    const isSelected = selectedIds.has(task.id);
                    const dest = destinations[task.id] ?? null;
                    const preview = getDestinationPreview(dest, task.id);
                    const pickerOpenForThis = pickerState?.taskId === task.id;

                    return (
                      <View key={task.id} style={styles.taskRow} testID={`task-row-${task.id}`}>
                        <Pressable
                          testID={`checkbox-${task.id}`}
                          style={[styles.checkbox, isSelected && styles.checkboxChecked]}
                          onPress={() => toggleTask(task.id)}
                          accessible
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: isSelected }}
                          accessibilityLabel={`Выбрать задачу: ${task.title}`}
                        >
                          {isSelected && <Text style={styles.checkmark}>✓</Text>}
                        </Pressable>

                        <View style={styles.taskInfo}>
                          <Text
                            testID={`task-title-${task.id}`}
                            style={[styles.taskTitle, !isSelected && styles.taskTitleUnselected]}
                            numberOfLines={2}
                          >
                            {task.title}
                          </Text>
                          <Text style={styles.taskDate}>
                            Было: {formatOverdueDate(task.startTime)}
                          </Text>

                          {isSelected && (
                            <View style={styles.destinationArea} testID={`dest-area-${task.id}`}>
                              <Text style={styles.destinationLabel}>Перенести:</Text>
                              <View style={styles.destinationButtons}>
                                <Pressable
                                  testID={`inbox-btn-${task.id}`}
                                  style={[styles.destButton, dest === 'inbox' && styles.destButtonActive]}
                                  onPress={() => setInbox(task.id)}
                                  accessible
                                  accessibilityRole="button"
                                  accessibilityState={{ selected: dest === 'inbox' }}
                                  accessibilityLabel="Переместить в раздел Мысли"
                                >
                                  <Text style={[styles.destButtonText, dest === 'inbox' && styles.destButtonTextActive]}>
                                    В «Мысли»
                                  </Text>
                                </Pressable>

                                <Pressable
                                  testID={`pick-time-btn-${task.id}`}
                                  style={[
                                    styles.destButton,
                                    dest !== null && dest !== 'inbox' && styles.destButtonActive,
                                    pickerOpenForThis && styles.destButtonPicking,
                                  ]}
                                  onPress={() => openDatePicker(task.id)}
                                  accessible
                                  accessibilityRole="button"
                                  accessibilityState={{ selected: dest !== null && dest !== 'inbox' }}
                                  accessibilityLabel="Выбрать дату и время"
                                >
                                  <Text style={[
                                    styles.destButtonText,
                                    dest !== null && dest !== 'inbox' && styles.destButtonTextActive,
                                  ]}>
                                    {pickerState?.phase === 'date' && pickerState.taskId === task.id
                                      ? 'Выбор даты…'
                                      : pickerState?.phase === 'time' && pickerState.taskId === task.id
                                      ? 'Выбор времени…'
                                      : 'Выбрать дату и время'}
                                  </Text>
                                </Pressable>
                              </View>

                              <Text
                                testID={`dest-preview-${task.id}`}
                                style={[
                                  styles.destinationPreview,
                                  preview.warn && styles.destinationPreviewWarn,
                                  !dest && !dstErrors[task.id] && styles.destinationPreviewEmpty,
                                ]}
                                accessibilityLabel={`Назначение: ${preview.text}`}
                              >
                                {preview.text}
                              </Text>

                              {pickerOpenForThis && pickerState?.phase === 'date' && (
                                <DateTimePicker
                                  testID={`date-picker-${task.id}`}
                                  value={pickerDateInitial}
                                  mode="date"
                                  minimumDate={minimumPickerDate}
                                  onChange={handleDatePickerChange}
                                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                />
                              )}
                              {pickerOpenForThis && pickerState?.phase === 'time' && (
                                <DateTimePicker
                                  testID={`time-picker-${task.id}`}
                                  value={pickerDateInitial}
                                  mode="time"
                                  onChange={handleTimePickerChange}
                                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                />
                              )}
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>

                {mutationError && (
                  <View testID="mutation-error-banner" style={styles.errorBanner}>
                    <Text style={styles.errorText}>{mutationError}</Text>
                  </View>
                )}

                <View style={styles.actions}>
                  <Pressable
                    testID="cancel-btn"
                    style={styles.cancelButton}
                    onPress={closeSheet}
                    disabled={isConfirming}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel="Отмена — никаких изменений"
                  >
                    <Text style={styles.cancelButtonText}>Отмена</Text>
                  </Pressable>

                  <Pressable
                    testID="confirm-btn"
                    style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}
                    onPress={handleConfirm}
                    disabled={!canConfirm}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={
                      selectedIds.size === 0
                        ? 'Подтвердить перенос — выберите задачи'
                        : !allValid
                        ? 'Подтвердить перенос — укажите место для всех задач'
                        : `Подтвердить перенос ${selectedIds.size} задач`
                    }
                    accessibilityState={{ disabled: !canConfirm, busy: isConfirming }}
                  >
                    {isConfirming ? (
                      <ActivityIndicator testID="confirm-spinner" color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.confirmButtonText}>
                        {selectedIds.size === 0
                          ? 'Выберите задачи'
                          : !allValid
                          ? 'Укажите место'
                          : `Перенести (${selectedIds.size})`}
                      </Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 20, marginVertical: 8, paddingHorizontal: 16, paddingVertical: 14,
    minHeight: 56, backgroundColor: '#FFF7ED', borderRadius: 10,
    borderWidth: 1, borderColor: '#FED7AA',
  },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  bannerTextCol: { flex: 1 },
  bannerIcon: { fontSize: 20, color: '#EA580C' },
  bannerTitle: { fontSize: 14, fontWeight: '600', color: '#9A3412' },
  bannerSubtitle: { fontSize: 12, color: '#C2410C', marginTop: 2 },
  bannerChevron: { fontSize: 22, color: '#EA580C', fontWeight: '600' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 20, paddingBottom: 8, maxHeight: '90%',
  },
  sheetHeader: { paddingHorizontal: 24, marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 },
  sheetSubtitle: { fontSize: 13, color: '#6B7280', lineHeight: 18 },

  timezoneError: {
    padding: 24, alignItems: 'center',
  },
  timezoneErrorText: {
    fontSize: 14, color: '#374151', textAlign: 'center', lineHeight: 20, marginBottom: 16,
  },
  timezoneErrorClose: {
    paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#F3F4F6', borderRadius: 8,
    minHeight: 44, justifyContent: 'center',
  },
  timezoneErrorCloseText: { fontSize: 15, color: '#374151', fontWeight: '600' },

  taskList: { flexGrow: 0, maxHeight: '55%' },
  taskListContent: { paddingHorizontal: 24, paddingBottom: 8 },
  taskRow: {
    flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 12,
  },
  checkbox: {
    width: 44, height: 44, borderRadius: 8, borderWidth: 2, borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: '#6B5BFC', borderColor: '#6B5BFC' },
  checkmark: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', lineHeight: 22 },

  taskInfo: { flex: 1 },
  taskTitle: { fontSize: 15, fontWeight: '500', color: '#111827', lineHeight: 20 },
  taskTitleUnselected: { color: '#6B7280' },
  taskDate: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  destinationArea: { marginTop: 10 },
  destinationLabel: { fontSize: 12, color: '#374151', fontWeight: '500', marginBottom: 8 },
  destinationButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  destButton: {
    minHeight: 44, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center',
  },
  destButtonActive: { backgroundColor: '#EDE9FE', borderColor: '#6B5BFC' },
  destButtonPicking: { backgroundColor: '#F5F3FF', borderColor: '#8B5CF6' },
  destButtonText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  destButtonTextActive: { color: '#6B5BFC', fontWeight: '600' },

  destinationPreview: { fontSize: 13, color: '#6B5BFC', marginTop: 8, fontStyle: 'italic' },
  destinationPreviewWarn: { color: '#DC2626', fontStyle: 'normal' },
  destinationPreviewEmpty: { color: '#9CA3AF', fontStyle: 'normal' },

  errorBanner: {
    marginHorizontal: 24, marginTop: 8, marginBottom: 4, padding: 10,
    backgroundColor: '#FEF2F2', borderRadius: 8, borderWidth: 1, borderColor: '#FECACA',
  },
  errorText: { fontSize: 13, color: '#DC2626' },

  actions: {
    flexDirection: 'row', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16, gap: 12,
  },
  cancelButton: {
    flex: 1, minHeight: 48, paddingVertical: 12, borderRadius: 10,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  cancelButtonText: { fontSize: 15, color: '#374151', fontWeight: '600' },
  confirmButton: {
    flex: 2, minHeight: 48, paddingVertical: 12, borderRadius: 10,
    backgroundColor: '#6B5BFC', alignItems: 'center', justifyContent: 'center',
  },
  confirmButtonDisabled: { backgroundColor: '#D1D5DB' },
  confirmButtonText: { fontSize: 15, color: '#FFFFFF', fontWeight: '600' },
});
