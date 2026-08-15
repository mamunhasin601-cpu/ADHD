import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateTask } from '../lib/api/tasks';
import { isFreeTierLimitError } from '../lib/api-error';
import { formatClockTime } from '../lib/time-format';
import { TASK_DURATION_PRESETS, TaskDurationPreset, taskDurationLabel } from '../lib/task-duration';
import { isValidIANATimezone, localMidnightToInstant, toCanonicalDateParam } from '../lib/timezone';
import { useAuthStore } from '../stores/auth.store';

type CaptureSelection = { instant: Date | null; selectedDate: Date; selectedDateKey: string };
type GlobalCaptureContextValue = { openTimelineCapture: (selection: CaptureSelection) => void };
type CaptureOperation = {
  id: number;
  ownerMounted: boolean;
  ownerId: string | null;
  sessionGeneration: number;
  selection: CaptureSelection;
  startTime: Date | null;
};

const GlobalCaptureContext = createContext<GlobalCaptureContextValue | null>(null);

export function useGlobalCapture() {
  const value = useContext(GlobalCaptureContext);
  // Screens are also rendered in isolation by focused tests and previews.
  // The production tabs always install the provider in their layout.
  return value ?? { openTimelineCapture: () => undefined };
}

function currentDaySelection(profileTimezone?: string | null): CaptureSelection {
  const now = new Date();
  const selectedDateKey = toCanonicalDateParam(now, profileTimezone);
  if (profileTimezone && isValidIANATimezone(profileTimezone)) {
    return { instant: null, selectedDate: localMidnightToInstant(selectedDateKey, profileTimezone), selectedDateKey };
  }
  const [year, month, day] = selectedDateKey.split('-').map(Number);
  return { instant: null, selectedDate: new Date(year, month - 1, day), selectedDateKey };
}

export function GlobalCaptureProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const profileTimezone = useAuthStore((state) => state.user?.timezone);
  const timeFormat = useAuthStore((state) => state.user?.timeFormat ?? 'SYSTEM');
  const ownerId = useAuthStore((state) => state.user?.id ?? null);
  const sessionGeneration = useAuthStore((state) => state.sessionGeneration);
  const [selection, setSelection] = useState<CaptureSelection>(() => currentDaySelection(profileTimezone));
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState<TaskDurationPreset>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionPending = useRef(false);
  const mounted = useRef(false);
  const operationIdentity = useRef(0);
  const createTask = useCreateTask(selection.selectedDate, profileTimezone);

  const resetAndClose = useCallback(() => {
    setOpen(false);
    setTitle('');
    setDuration(null);
    setSelection(currentDaySelection(profileTimezone));
  }, [profileTimezone]);

  useEffect(() => {
    // React 18 development effect replay runs setup again after cleanup. Always
    // restore mounted ownership in setup instead of initializing the ref true.
    mounted.current = true;
    return () => {
      mounted.current = false;
      operationIdentity.current += 1;
      submissionPending.current = false;
    };
  }, []);

  useEffect(() => {
    // Session, owner, and path transitions invalidate an already-issued
    // request before resetting the sheet. The request may settle, but its
    // continuation can no longer touch caches or UI.
    operationIdentity.current += 1;
    submissionPending.current = false;
    setIsSubmitting(false);
    resetAndClose();
  }, [ownerId, pathname, resetAndClose, sessionGeneration]);

  const openTimelineCapture = useCallback((next: CaptureSelection) => {
    setSelection(next);
    setTitle('');
    setDuration(null);
    setOpen(true);
  }, []);

  const openGlobalCapture = () => {
    setSelection(currentDaySelection(profileTimezone));
    setTitle('');
    setDuration(null);
    setOpen(true);
  };

  async function submit(startTime: Date | null = selection.instant) {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || submissionPending.current) return;
    submissionPending.current = true;
    setIsSubmitting(true);
    const operation: CaptureOperation = {
      id: ++operationIdentity.current,
      ownerMounted: mounted.current,
      ownerId,
      sessionGeneration,
      selection: { ...selection },
      startTime,
    };
    const ownsContinuation = () => {
      const currentAuth = useAuthStore.getState();
      return operation.ownerMounted && mounted.current &&
        operationIdentity.current === operation.id &&
        (currentAuth.user?.id ?? null) === operation.ownerId &&
        currentAuth.sessionGeneration === operation.sessionGeneration;
    };
    try {
      await createTask.mutateAsync({ title: trimmedTitle, startTime: startTime?.toISOString() ?? null, durationMinutes: duration });
      if (!ownsContinuation()) return;
      await queryClient.refetchQueries({ queryKey: ['tasks', 'inbox'] });
      if (!ownsContinuation()) return;
      if (operation.startTime) {
        if (!ownsContinuation()) return;
        await queryClient.refetchQueries({ queryKey: ['tasks', operation.selection.selectedDateKey] });
        if (!ownsContinuation()) return;
      }
      if (!ownsContinuation()) return;
      resetAndClose();
    } catch (error) {
      if (!ownsContinuation()) return;
      if (isFreeTierLimitError(error)) {
        if (!ownsContinuation()) return;
        resetAndClose();
        if (!ownsContinuation()) return;
        router.push('/paywall');
      } else {
        if (!ownsContinuation()) return;
        Alert.alert('Не удалось создать задачу', 'Проверьте соединение и попробуйте снова');
      }
    } finally {
      if (ownsContinuation()) {
        submissionPending.current = false;
        setIsSubmitting(false);
      }
    }
  }

  function openFullForm() {
    if (submissionPending.current) return;
    const trimmedTitle = title.trim();
    setOpen(false);
    router.push({
      pathname: '/task-form',
      params: {
        ...(trimmedTitle ? { prefillTitle: trimmedTitle } : {}),
        ...(selection.instant ? { prefillStartTime: selection.instant.toISOString() } : {}),
        ...(duration !== null ? { prefillDurationMinutes: String(duration) } : {}),
        selectedDate: selection.selectedDate.toISOString(),
        selectedDateKey: selection.selectedDateKey,
      },
    });
  }

  const disabled = !title.trim() || isSubmitting;
  const busy = isSubmitting;
  return (
    <GlobalCaptureContext.Provider value={{ openTimelineCapture }}>
      <View style={styles.owner}>{children}</View>
      <Pressable
        testID="global-capture-action"
        style={[styles.fab, busy && styles.disabled]}
        onPress={openGlobalCapture}
        accessibilityRole="button"
        accessibilityLabel="Добавить задачу"
        accessibilityState={{ disabled: busy, busy }}
        disabled={busy}
      ><Text style={styles.fabText}>＋</Text></Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={resetAndClose}>
        <View style={styles.overlay}><View style={styles.card}>
          <Text style={styles.title}>Новая задача</Text>
          <TextInput style={styles.input} placeholder="Название" placeholderTextColor="#9CA3AF" value={title} onChangeText={setTitle} autoFocus onSubmitEditing={() => submit()} returnKeyType="done" accessibilityLabel="Название задачи" />
          <Text style={styles.hint}>{selection.instant ? `Выбранное время: ${formatClockTime(selection.instant, timeFormat)}` : 'Без времени — запись сохранится в «Мысли»'}</Text>
          <Text style={styles.durationLabel}>Примерная длительность</Text>
          <View style={styles.presets}>{TASK_DURATION_PRESETS.map((value) => (
            <Pressable key={value ?? 'unknown'} onPress={() => setDuration(value)} accessibilityRole="button" accessibilityLabel={`Длительность ${taskDurationLabel(value)}`} accessibilityState={{ selected: duration === value }} style={[styles.chip, duration === value && styles.chipActive]}>
              <Text style={[styles.chipText, duration === value && styles.chipTextActive]}>{taskDurationLabel(value)}</Text>
            </Pressable>
          ))}</View>
          <View style={styles.actions}>
            <Pressable onPress={resetAndClose} accessibilityRole="button" accessibilityLabel="Отменить быстрое добавление"><Text style={styles.secondary}>Отмена</Text></Pressable>
            <Pressable onPress={openFullForm} accessibilityRole="button" accessibilityLabel="Открыть полную форму задачи" accessibilityState={{ disabled: busy }} disabled={busy}><Text style={styles.secondary}>Подробнее →</Text></Pressable>
            {selection.instant && <Pressable onPress={() => submit(null)} accessibilityRole="button" accessibilityLabel="Сохранить задачу в Мысли без времени" accessibilityState={{ disabled, busy }} disabled={disabled}><Text style={styles.thoughts}>В Мысли</Text></Pressable>}
            <Pressable onPress={() => submit()} style={[styles.submit, disabled && styles.disabled]} accessibilityRole="button" accessibilityLabel={selection.instant ? `Добавить задачу на ${formatClockTime(selection.instant, timeFormat)}` : 'Сохранить задачу в Мысли'} accessibilityState={{ disabled, busy }} disabled={disabled}>
              {busy ? <ActivityIndicator color="#FFFFFF" accessibilityLabel="Сохранение задачи" /> : <Text style={styles.submitText}>{selection.instant ? `Добавить на ${formatClockTime(selection.instant, timeFormat)}` : 'Сохранить в Мысли'}</Text>}
            </Pressable>
          </View>
        </View></View>
      </Modal>
    </GlobalCaptureContext.Provider>
  );
}

const styles = StyleSheet.create({
  owner: { flex: 1 },
  fab: { position: 'absolute', right: 24, bottom: 88, width: 56, height: 56, borderRadius: 28, backgroundColor: '#6B5BFC', alignItems: 'center', justifyContent: 'center', elevation: 5 },
  fabText: { color: '#FFFFFF', fontSize: 32, lineHeight: 36 },
  disabled: { opacity: 0.5 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, padding: 14, fontSize: 16, color: '#111827' },
  hint: { color: '#6B7280', marginTop: 10 },
  durationLabel: { color: '#374151', fontWeight: '600', marginTop: 16, marginBottom: 8 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: '#F3F4F6' },
  chipActive: { backgroundColor: '#EDE9FE' },
  chipText: { color: '#4B5563' },
  chipTextActive: { color: '#5B4BE7', fontWeight: '600' },
  actions: { marginTop: 22, gap: 14, alignItems: 'stretch' },
  secondary: { color: '#6B5BFC', textAlign: 'center', paddingVertical: 4 },
  thoughts: { color: '#5B4BE7', fontWeight: '600', textAlign: 'center', paddingVertical: 8 },
  submit: { minHeight: 48, borderRadius: 10, backgroundColor: '#6B5BFC', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  submitText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16, textAlign: 'center' },
});
