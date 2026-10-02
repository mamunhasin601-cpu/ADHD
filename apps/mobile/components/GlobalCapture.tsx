import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateTask } from '../lib/api/tasks';
import { isFreeTierLimitError, isTaskTimeSlotOccupiedError } from '../lib/api-error';
import { formatClockTime } from '../lib/time-format';
import { TaskDurationPreset, taskDurationLabel } from '../lib/task-duration';
import { isValidIANATimezone, localMidnightToInstant, toCanonicalDateParam } from '../lib/timezone';
import { useAuthStore } from '../stores/auth.store';
import { useOrbitsTheme } from '../theme/orbits';
import { FocusDialog, useFocusDialog } from './FocusDialog';

type CaptureSelection = { instant: Date | null; selectedDate: Date; selectedDateKey: string };
type GlobalCaptureContextValue = {
  openTimelineCapture: (selection: CaptureSelection) => void;
  openGlobalCapture: () => void;
  setGlobalCaptureDateContext: (selection: Omit<CaptureSelection, 'instant'> | null) => void;
};
type CaptureOperation = {
  id: number;
  ownerMounted: boolean;
  ownerId: string | null;
  sessionGeneration: number;
  selection: CaptureSelection;
  startTime: Date | null;
};
type CaptureDragOrigin = { pageX: number; pageY: number; timestamp: number };

const CAPTURE_SWIPE_DISMISS_DISTANCE = 96;
const CAPTURE_SWIPE_DISMISS_VELOCITY = 900;
const CAPTURE_SWIPE_DISMISS_TARGET = 360;
const DURATION_GRID_COLUMNS: ReadonlyArray<ReadonlyArray<TaskDurationPreset>> = [
  [null, 45, 120],
  [15, 60],
  [30, 90],
];

const GlobalCaptureContext = createContext<GlobalCaptureContextValue | null>(null);

export function useGlobalCapture() {
  const value = useContext(GlobalCaptureContext);
  // Screens are also rendered in isolation by focused tests and previews.
  // The production tabs always install the provider in their layout.
  return value ?? {
    openTimelineCapture: () => undefined,
    openGlobalCapture: () => undefined,
    setGlobalCaptureDateContext: () => undefined,
  };
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

export function GlobalCaptureProvider({ children, showFloatingAction = true }: { children: React.ReactNode; showFloatingAction?: boolean }) {
  const router = useRouter();
  const theme = useOrbitsTheme();
  const { showDialog, dialogProps } = useFocusDialog();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const profileTimezone = useAuthStore((state) => state.user?.timezone);
  const timeFormat = useAuthStore((state) => state.user?.timeFormat ?? 'SYSTEM');
  const ownerId = useAuthStore((state) => state.user?.id ?? null);
  const sessionGeneration = useAuthStore((state) => state.sessionGeneration);
  const [selection, setSelection] = useState<CaptureSelection>(() => currentDaySelection(profileTimezone));
  const [globalDateContext, setGlobalDateContext] = useState<Omit<CaptureSelection, 'instant'> | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState<TaskDurationPreset>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionPending = useRef(false);
  const captureScrollRef = useRef<ScrollView>(null);
  const captureTranslateY = useRef(new Animated.Value(0)).current;
  const captureDragOrigin = useRef<CaptureDragOrigin | null>(null);
  const captureLastDrag = useRef({ dx: 0, dy: 0, elapsedMs: 1 });
  const swipeDismissPending = useRef(false);
  const mounted = useRef(false);
  const operationIdentity = useRef(0);
  const createTask = useCreateTask(selection.selectedDate, profileTimezone);

  const resetCapturePresentation = useCallback(() => {
    captureTranslateY.stopAnimation();
    captureTranslateY.setValue(0);
    captureDragOrigin.current = null;
    captureLastDrag.current = { dx: 0, dy: 0, elapsedMs: 1 };
    swipeDismissPending.current = false;
    captureScrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [captureTranslateY]);

  const closePreservingDraft = useCallback(() => {
    Keyboard.dismiss();
    resetCapturePresentation();
    setOpen(false);
  }, [resetCapturePresentation]);

  const clearDraft = useCallback(() => {
    setTitle('');
    setDuration(null);
    setSelection(currentDaySelection(profileTimezone));
  }, [profileTimezone]);

  const clearAndClose = useCallback(() => {
    closePreservingDraft();
    clearDraft();
  }, [clearDraft, closePreservingDraft]);

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
    // A session/owner boundary invalidates pending work and clears the local
    // private draft so it can never cross into another authenticated identity.
    operationIdentity.current += 1;
    submissionPending.current = false;
    setIsSubmitting(false);
    clearAndClose();
  }, [clearAndClose, ownerId, sessionGeneration]);

  useEffect(() => {
    // Route changes invalidate a request and dismiss the sheet, but ordinary
    // navigation is not a privacy boundary and therefore preserves the draft.
    operationIdentity.current += 1;
    submissionPending.current = false;
    setIsSubmitting(false);
    closePreservingDraft();
  }, [closePreservingDraft, pathname]);

  const openTimelineCapture = useCallback((next: CaptureSelection) => {
    resetCapturePresentation();
    setSelection(next);
    setOpen(true);
  }, [resetCapturePresentation]);

  const openGlobalCapture = useCallback(() => {
    resetCapturePresentation();
    if (!title.trim() && duration === null) {
      const onToday = pathname === '/today' || pathname.endsWith('/today');
      setSelection(onToday && globalDateContext
        ? { ...globalDateContext, instant: null }
        : currentDaySelection(profileTimezone));
    }
    setOpen(true);
  }, [duration, globalDateContext, pathname, profileTimezone, resetCapturePresentation, title]);

  const setGlobalCaptureDateContext = useCallback((next: Omit<CaptureSelection, 'instant'> | null) => {
    setGlobalDateContext(next);
  }, []);

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
      clearAndClose();
    } catch (error) {
      if (!ownsContinuation()) return;
      if (isFreeTierLimitError(error)) {
        if (!ownsContinuation()) return;
        closePreservingDraft();
        if (!ownsContinuation()) return;
        router.push('/paywall');
      } else if (isTaskTimeSlotOccupiedError(error)) {
        showDialog({ title: 'Это время уже занято', message: 'Выберите другое время или измените длительность.' });
      } else {
        if (!ownsContinuation()) return;
        showDialog({ title: 'Не удалось создать задачу', message: 'Проверьте соединение и попробуйте снова' });
      }
    } finally {
      if (ownsContinuation()) {
        submissionPending.current = false;
        setIsSubmitting(false);
      }
    }
  }

  function openFullForm(prefillKind: 'TASK' | 'REST' = 'TASK') {
    if (submissionPending.current) return;
    const trimmedTitle = title.trim();
    setOpen(false);
    router.push({
      pathname: '/task-form',
      params: {
        ...(trimmedTitle ? { prefillTitle: trimmedTitle } : {}),
        ...(selection.instant ? { prefillStartTime: selection.instant.toISOString() } : {}),
        ...(duration !== null ? { prefillDurationMinutes: String(duration) } : {}),
        prefillKind,
        selectedDate: selection.selectedDate.toISOString(),
        selectedDateKey: selection.selectedDateKey,
      },
    });
    clearDraft();
    resetCapturePresentation();
    Keyboard.dismiss();
  }

  const disabled = !title.trim() || isSubmitting;
  const busy = isSubmitting;
  const displayTimezone = profileTimezone && isValidIANATimezone(profileTimezone)
    ? profileTimezone
    : undefined;
  const selectedTimeLabel = selection.instant
    ? formatClockTime(selection.instant, timeFormat, { timeZone: displayTimezone })
    : null;
  const restoreCapturePosition = useCallback(() => {
    captureTranslateY.stopAnimation();
    Animated.spring(captureTranslateY, {
      toValue: 0,
      speed: 24,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  }, [captureTranslateY]);
  const beginCaptureDrag = useCallback((event: GestureResponderEvent) => {
    const { pageX, pageY, timestamp } = event.nativeEvent;
    captureTranslateY.stopAnimation();
    swipeDismissPending.current = false;
    captureDragOrigin.current = { pageX, pageY, timestamp };
    captureLastDrag.current = { dx: 0, dy: 0, elapsedMs: 1 };
  }, [captureTranslateY]);
  const moveCaptureDrag = useCallback((event: GestureResponderEvent) => {
    const origin = captureDragOrigin.current;
    if (!origin || swipeDismissPending.current) return;
    const dx = event.nativeEvent.pageX - origin.pageX;
    const dy = event.nativeEvent.pageY - origin.pageY;
    const elapsedMs = Math.max(1, event.nativeEvent.timestamp - origin.timestamp);
    captureLastDrag.current = { dx, dy, elapsedMs };
    const isDownwardVertical = dy > 0 && dy > Math.abs(dx);
    captureTranslateY.setValue(isDownwardVertical ? dy : 0);
  }, [captureTranslateY]);
  const cancelCaptureDrag = useCallback(() => {
    captureDragOrigin.current = null;
    captureLastDrag.current = { dx: 0, dy: 0, elapsedMs: 1 };
    restoreCapturePosition();
  }, [restoreCapturePosition]);
  const finishCaptureDrag = useCallback((event: GestureResponderEvent) => {
    if (swipeDismissPending.current) return;
    const origin = captureDragOrigin.current;
    let { dx, dy, elapsedMs } = captureLastDrag.current;
    if (origin) {
      dx = event.nativeEvent.pageX - origin.pageX;
      dy = event.nativeEvent.pageY - origin.pageY;
      elapsedMs = Math.max(1, event.nativeEvent.timestamp - origin.timestamp);
    }
    captureDragOrigin.current = null;
    const downwardVelocity = (dy / elapsedMs) * 1000;
    const isDownwardVertical = dy > 0 && dy > Math.abs(dx);
    const shouldDismiss = isDownwardVertical && (
      dy >= CAPTURE_SWIPE_DISMISS_DISTANCE ||
      downwardVelocity >= CAPTURE_SWIPE_DISMISS_VELOCITY
    );
    if (!shouldDismiss) {
      captureLastDrag.current = { dx: 0, dy: 0, elapsedMs: 1 };
      restoreCapturePosition();
      return;
    }
    swipeDismissPending.current = true;
    captureTranslateY.stopAnimation();
    Animated.timing(captureTranslateY, {
      toValue: Math.max(CAPTURE_SWIPE_DISMISS_TARGET, dy),
      duration: 160,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished || !swipeDismissPending.current) return;
      closePreservingDraft();
    });
  }, [captureTranslateY, closePreservingDraft, restoreCapturePosition]);
  return (
    <GlobalCaptureContext.Provider value={{ openTimelineCapture, openGlobalCapture, setGlobalCaptureDateContext }}>
      <View style={styles.owner}>{children}</View>
      {showFloatingAction && <Pressable
        testID="global-capture-action"
        style={[styles.fab, { backgroundColor: theme.brand }, busy && styles.disabled]}
        onPress={openGlobalCapture}
        accessibilityRole="button"
        accessibilityLabel="Добавить запись: задачу, мысль или отдых"
        accessibilityState={{ disabled: busy, busy }}
        disabled={busy}
      ><Text style={[styles.fabText, { color: theme.retryText }]}>＋</Text></Pressable>}
      <Modal
        testID="quick-capture-modal"
        visible={open}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={closePreservingDraft}
        onShow={resetCapturePresentation}
      >
        <KeyboardAvoidingView
          testID="quick-capture-keyboard-view"
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View
            testID="quick-capture-scrim"
            pointerEvents="none"
            style={[styles.scrim, { backgroundColor: theme.elevationShadow }]}
          />
          <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
            <Pressable
              testID="quick-capture-backdrop"
              style={StyleSheet.absoluteFill}
              onPress={closePreservingDraft}
              accessibilityRole="button"
              accessibilityLabel="Закрыть быстрое добавление"
            />
            <Animated.View
              testID="quick-capture-surface"
              style={[
                styles.card,
                { backgroundColor: theme.background, borderColor: theme.borderSubtle },
                { transform: [{ translateY: captureTranslateY }] },
              ]}
            >
              <View
                testID="quick-capture-drag-region"
                style={styles.dragRegion}
                onStartShouldSetResponder={() => true}
                onResponderGrant={beginCaptureDrag}
                onResponderMove={moveCaptureDrag}
                onResponderRelease={finishCaptureDrag}
                onResponderTerminate={cancelCaptureDrag}
                accessible={false}
              >
                <View
                  testID="quick-capture-drag-handle"
                  style={[styles.dragHandle, { backgroundColor: theme.borderSubtle }]}
                  accessible={false}
                />
              </View>
              <ScrollView
                ref={captureScrollRef}
                testID="quick-capture-scroll-view"
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.cardContent}
                accessibilityViewIsModal
                accessibilityLabel="Быстрое добавление записи"
              >
                <Text style={[styles.title, { color: theme.textPrimary }]}>Новая запись</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surfacePrimary, borderColor: theme.borderSubtle, color: theme.textPrimary }]}
                  placeholder="Название"
                  placeholderTextColor={theme.textSecondary}
                  selectionColor={theme.brand}
                  value={title}
                  onChangeText={setTitle}
                  onFocus={() => captureScrollRef.current?.scrollTo({ y: 0, animated: true })}
                  autoFocus
                  onSubmitEditing={() => submit()}
                  returnKeyType="done"
                  accessibilityLabel="Название записи"
                />
                <Text style={[styles.hint, { color: theme.textSecondary }]}>{selectedTimeLabel ? `Выбранное время: ${selectedTimeLabel}` : 'Без времени — запись сохранится в «Мысли»'}</Text>
                <Text style={[styles.durationLabel, { color: theme.textPrimary }]}>Примерная длительность</Text>
                <View testID="quick-capture-duration-grid" style={styles.durationGrid}>
                  {DURATION_GRID_COLUMNS.map((column, columnIndex) => (
                    <View
                      key={`duration-column-${columnIndex + 1}`}
                      testID={`quick-capture-duration-column-${columnIndex + 1}`}
                      style={styles.durationColumn}
                    >
                      {column.map((value) => {
                        const selected = duration === value;
                        return (
                          <Pressable
                            key={value ?? 'unknown'}
                            testID={`quick-capture-duration-${value ?? 'unknown'}`}
                            onPress={() => setDuration(value)}
                            accessibilityRole="button"
                            accessibilityLabel={`Длительность ${taskDurationLabel(value)}`}
                            accessibilityState={{ selected }}
                            style={({ pressed }) => [
                              styles.chip,
                              styles.durationChip,
                              {
                                backgroundColor: selected ? theme.activeSurface : theme.surfaceMuted,
                                borderColor: selected ? theme.activeBorder : theme.borderSubtle,
                              },
                              pressed && { backgroundColor: theme.activeSurface, borderColor: theme.activeBorder },
                            ]}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                styles.durationChipText,
                                { color: selected ? theme.activeSurfaceText : theme.textPrimary },
                                selected && styles.chipTextActive,
                              ]}
                            >
                              {taskDurationLabel(value)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
                </View>
                <View style={styles.actions}>
                  <Pressable onPress={clearAndClose} accessibilityRole="button" accessibilityLabel="Отменить быстрое добавление"><Text style={[styles.secondary, { color: theme.activeBorder }]}>Отмена</Text></Pressable>
                  <Pressable onPress={() => openFullForm('TASK')} accessibilityRole="button" accessibilityLabel="Открыть полную форму задачи" accessibilityState={{ disabled: busy }} disabled={busy}><Text style={[styles.secondary, { color: busy ? theme.textSecondary : theme.activeBorder }]}>Подробнее о задаче</Text></Pressable>
                  <View style={styles.blockActions}>
                    <Pressable onPress={() => openFullForm('REST')} accessibilityRole="button" accessibilityLabel="Открыть полную форму отдыха" accessibilityState={{ disabled: busy }} disabled={busy} style={[styles.blockAction, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle }, busy && styles.disabled]}><Text style={[styles.blockActionText, { color: busy ? theme.textSecondary : theme.textPrimary }]}>Отдых</Text></Pressable>
                  </View>
                  {selection.instant && <Pressable onPress={() => submit(null)} accessibilityRole="button" accessibilityLabel="Сохранить задачу в Мысли без времени" accessibilityState={{ disabled, busy }} disabled={disabled}><Text style={[styles.thoughts, { color: disabled ? theme.textSecondary : theme.activeBorder }]}>В Мысли</Text></Pressable>}
                  <Pressable onPress={() => submit()} style={[styles.submit, { backgroundColor: disabled ? theme.surfaceMuted : theme.brand, borderColor: disabled ? theme.borderSubtle : theme.brand }, disabled && styles.disabled]} accessibilityRole="button" accessibilityLabel={selectedTimeLabel ? `Добавить задачу на ${selectedTimeLabel}` : 'Сохранить задачу в Мысли'} accessibilityState={{ disabled, busy }} disabled={disabled}>
                    {busy ? <ActivityIndicator color={theme.retryText} accessibilityLabel="Сохранение задачи" /> : <Text style={[styles.submitText, { color: disabled ? theme.textSecondary : theme.retryText }]}>{selectedTimeLabel ? `Добавить на ${selectedTimeLabel}` : 'Сохранить в Мысли'}</Text>}
                  </Pressable>
                </View>
              </ScrollView>
            </Animated.View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
      <FocusDialog {...dialogProps} />
    </GlobalCaptureContext.Provider>
  );
}

const styles = StyleSheet.create({
  owner: { flex: 1 },
  fab: { position: 'absolute', right: 24, bottom: 88, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 5 },
  fabText: { fontSize: 32, lineHeight: 36 },
  disabled: { opacity: 0.5 },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, opacity: 0.55 },
  safeArea: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  card: { maxHeight: '100%', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, overflow: 'hidden' },
  dragRegion: { height: 28, alignItems: 'center', justifyContent: 'center' },
  dragHandle: { width: 40, height: 4, borderRadius: 2 },
  cardContent: { flexGrow: 1, padding: 24, paddingBottom: 36 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  input: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 16 },
  hint: { marginTop: 10 },
  durationLabel: { fontWeight: '600', marginTop: 16, marginBottom: 8 },
  durationGrid: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  durationColumn: { flex: 1, gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, borderWidth: 1 },
  durationChip: { alignSelf: 'stretch', minHeight: 44, paddingHorizontal: 8, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  chipText: {},
  durationChipText: { flexShrink: 1, textAlign: 'center' },
  chipTextActive: { fontWeight: '600' },
  actions: { marginTop: 22, gap: 14, alignItems: 'stretch' },
  secondary: { textAlign: 'center', paddingVertical: 4 },
  blockActions: { flexDirection: 'row', gap: 10 },
  blockAction: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  blockActionText: { fontWeight: '600' },
  thoughts: { fontWeight: '600', textAlign: 'center', paddingVertical: 8 },
  submit: { minHeight: 48, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  submitText: { fontWeight: '700', fontSize: 16, textAlign: 'center' },
});
