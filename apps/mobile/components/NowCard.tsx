import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Task } from "@focus/shared-types";
import { useAuthStore } from "../stores/auth.store";
import { formatClockTime } from "../lib/time-format";
import { useOrbitsTheme } from "../theme/orbits";
import { normalizeTaskColor, taskInkWash, taskTextColor } from "./today/task-color";
import { isValidIANATimezone } from "../lib/timezone";

type NowCardMode = "planned-now" | "not-started" | "upcoming" | "current";

interface Props {
  task: Task;
  mode: NowCardMode;
  onComplete: (taskId: string) => void;
  onStart: (taskId: string) => Promise<void> | void;
  onOpenTask: (task: Task) => void;
  onShowActions?: (task: Task) => void;
  onSaveFirstStep: (taskId: string, firstStep: string) => Promise<Task>;
  isCompleting?: boolean;
  isStarting?: boolean;
  startError?: string | null;
  isSavingFirstStep?: boolean;
  embeddedInTimeline?: boolean;
}

/**
 * Главная точка действия на Today.
 *
 * Компонент намеренно использует только уже существующие состояния Task:
 * завершение текущей задачи и открытие ближайшей. Состояние "начата" и
 * focus-session не имитируются до появления отдельного продуктового контракта.
 */
export function NowCard({
  task,
  mode,
  onComplete,
  onStart,
  onOpenTask,
  onShowActions,
  onSaveFirstStep,
  isCompleting = false,
  isStarting = false,
  startError = null,
  isSavingFirstStep = false,
  embeddedInTimeline = false,
}: Props) {
  const theme = useOrbitsTheme();
  const [supportOpen, setSupportOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.firstStep ?? "");
  const [savedStep, setSavedStep] = useState(task.firstStep);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveGuard = useRef(false);
  const [localSavePending, setLocalSavePending] = useState(false);
  const modalStartGuard = useRef(false);
  const [modalStartPending, setModalStartPending] = useState(false);
  const [stepSelected, setStepSelected] = useState(false);
  const mountedRef = useRef(true);
  const renderedTaskIdRef = useRef(task.id);
  const saveGenerationRef = useRef(0);
  const startGenerationRef = useRef(0);
  renderedTaskIdRef.current = task.id;

  useEffect(() => {
    // React 18 StrictMode may replay setup after cleanup in development.
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      saveGenerationRef.current += 1;
      startGenerationRef.current += 1;
    };
  }, []);

  useEffect(() => {
    saveGenerationRef.current += 1;
    startGenerationRef.current += 1;
    setSupportOpen(false);
    setEditing(false);
    setDraft(task.firstStep ?? "");
    setSavedStep(task.firstStep);
    setSaveError(null);
    saveGuard.current = false;
    setLocalSavePending(false);
    modalStartGuard.current = false;
    setModalStartPending(false);
    setStepSelected(false);
  }, [task.id]);
  useEffect(() => {
    if (task.startedAt || task.completedAt) {
      saveGenerationRef.current += 1;
      startGenerationRef.current += 1;
      saveGuard.current = false;
      setLocalSavePending(false);
      setSupportOpen(false);
      setEditing(false);
      setSaveError(null);
      modalStartGuard.current = false;
      setModalStartPending(false);
      setStepSelected(false);
    }
  }, [task.startedAt, task.completedAt]);
  useEffect(() => {
    setSavedStep(task.firstStep);
    if (!editing) setDraft(task.firstStep ?? "");
  // A canonical mutation response may replace the persisted value. Editing is
  // intentionally not a dependency: opening the editor must never erase input.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.firstStep]);
  const timeFormat = useAuthStore(
    (state) => state.user?.timeFormat ?? "SYSTEM",
  );
  const profileTimezone = useAuthStore((state) => state.user?.timezone);
  const time = task.startTime
    ? formatClockTime(new Date(task.startTime), timeFormat, {
        timeZone: profileTimezone && isValidIANATimezone(profileTimezone) ? profileTimezone : undefined,
      })
    : null;
  const isStarted = task.startedAt !== null;
  const stateLabel = isStarted
    ? 'Выполняется'
    : mode === 'planned-now' || mode === 'current'
      ? 'Сейчас по плану'
      : mode === 'not-started'
        ? 'Не начато'
        : 'Запланировано';
  const savePending = isSavingFirstStep || localSavePending;
  const actionsDisabled = isStarting || isCompleting || savePending || modalStartPending;
  const accent = normalizeTaskColor(task.color, theme.brand);
  const buttonInk = taskTextColor(accent, theme.brand);
  const accentBorder = taskInkWash(accent, '70');

  function toggleFirstStepSelection() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStepSelected((selected) => !selected);
  }

  async function saveFirstStep() {
    const value = draft.trim();
    if (!value || saveGuard.current || savePending) return;
    const requestTaskId = task.id;
    const requestGeneration = ++saveGenerationRef.current;
    const requestIsCurrent = () =>
      mountedRef.current &&
      renderedTaskIdRef.current === requestTaskId &&
      saveGenerationRef.current === requestGeneration;
    saveGuard.current = true;
    setLocalSavePending(true);
    setSaveError(null);
    try {
      const canonical = await onSaveFirstStep(task.id, value);
      if (!requestIsCurrent()) return;
      setSavedStep(canonical.firstStep);
      setDraft(canonical.firstStep ?? "");
      setEditing(false);
    } catch {
      if (!requestIsCurrent()) return;
      setSaveError("Не удалось сохранить шаг. Проверьте соединение и попробуйте снова.");
    } finally {
      if (!requestIsCurrent()) return;
      saveGuard.current = false;
      setLocalSavePending(false);
    }
  }

  async function startFromStep() {
    if (modalStartGuard.current || isStarting || savePending) return;
    const requestTaskId = task.id;
    const requestGeneration = ++startGenerationRef.current;
    const requestIsCurrent = () =>
      mountedRef.current &&
      renderedTaskIdRef.current === requestTaskId &&
      startGenerationRef.current === requestGeneration;
    modalStartGuard.current = true;
    setModalStartPending(true);
    try {
      await onStart(task.id);
    } catch {
      // The parent owns the task-scoped retryable error; keep this surface open.
    } finally {
      if (!requestIsCurrent()) return;
      modalStartGuard.current = false;
      setModalStartPending(false);
    }
  }

  return (
    <View
      testID="now-card"
      style={[
        styles.card,
        embeddedInTimeline && styles.embeddedCard,
        (mode === 'planned-now' || mode === 'current') && styles.plannedNowCard,
        { backgroundColor: theme.surfacePrimary, borderColor: mode === 'not-started' ? theme.borderSubtle : accentBorder, shadowColor: theme.elevationShadow },
      ]}
      accessibilityRole="summary"
      accessibilityLabel={`${task.title}. ${stateLabel}${time ? `. Запланировано на ${time}` : ''}`}
    >
      <View testID="now-card-accent-rail" style={[styles.accentRail, { backgroundColor: accent }]} />
      <View style={styles.headerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Изменить задачу ${task.title}`}
          accessibilityHint={onShowActions ? "Нажмите, чтобы открыть план. Удерживайте для переноса или отправки в Мысли" : "Открыть план задачи"}
          accessibilityState={{ disabled: actionsDisabled }}
          disabled={actionsDisabled}
          delayLongPress={520}
          onLongPress={() => onShowActions?.(task)}
          onPress={() => onOpenTask(task)}
          style={({ pressed }) => [styles.headerCopy, pressed && styles.buttonPressed]}
        >
          <Text style={[styles.eyebrow, { color: mode === 'not-started' ? theme.textSecondary : accent }]}>{stateLabel}</Text>
          <Text style={[styles.meta, { color: theme.textSecondary }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
            {time ?? 'Без времени'}  •  {task.durationMinutes === null ? 'Не знаю' : `${task.durationMinutes} мин`}
          </Text>
          <Text style={[styles.title, { color: theme.textPrimary }]} numberOfLines={2} maxFontSizeMultiplier={1.25}>
            {task.title}
          </Text>
        </Pressable>
        <Pressable
          testID="now-card-completion"
          accessibilityRole="checkbox"
          accessibilityLabel={`${task.completedAt ? 'Вернуть' : 'Завершить'} задачу ${task.title}`}
          accessibilityState={{ checked: Boolean(task.completedAt), disabled: actionsDisabled, busy: isCompleting }}
          disabled={actionsDisabled}
          hitSlop={8}
          onPress={() => onComplete(task.id)}
          style={({ pressed }) => [
            styles.completionCheck,
            { borderColor: accent, backgroundColor: task.completedAt ? accent : 'transparent' },
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={[styles.completionCheckMark, { color: buttonInk }]}>{isCompleting ? '·' : task.completedAt ? '✓' : ''}</Text>
        </Pressable>
      </View>

      {!isStarted && savedStep && !supportOpen ? (
        <Pressable
          testID="now-card-first-step"
          accessibilityRole="checkbox"
          accessibilityLabel={`Первый шаг: ${savedStep}`}
          accessibilityHint="Нажмите, чтобы выбрать шаг. Удерживайте, чтобы изменить"
          accessibilityState={{ checked: stepSelected, disabled: actionsDisabled }}
          disabled={actionsDisabled}
          delayLongPress={350}
          onLongPress={() => {
            setDraft(savedStep);
            setEditing(false);
            setSaveError(null);
            setSupportOpen(true);
          }}
          onPress={toggleFirstStepSelection}
          style={({ pressed }) => [
            styles.firstStep,
            pressed && styles.buttonPressed,
          ]}
        >
          <View style={[styles.stepCheck, { borderColor: accent, backgroundColor: stepSelected ? accent : 'transparent' }]}>
            <Text style={[styles.stepCheckMark, { color: buttonInk }]}>{stepSelected ? '✓' : ''}</Text>
          </View>
          <Text style={[styles.stepValue, { color: theme.textPrimary }]} numberOfLines={1}>{savedStep}</Text>
        </Pressable>
      ) : null}

      {startError && !supportOpen && !task.startedAt && !task.completedAt ? (
        <Text accessibilityRole="alert" style={[styles.inlineError, { color: theme.errorPrimary, backgroundColor: theme.errorSoft }]}>{startError}</Text>
      ) : null}

      <View testID="now-card-actions" style={styles.actions}>
        {!isStarted ? (
          <>
          {!savedStep && !task.completedAt ? <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Помощь с началом задачи ${task.title}`}
            disabled={actionsDisabled}
            accessibilityState={{ disabled: actionsDisabled }}
            onPress={() => { setDraft(""); setEditing(true); setSaveError(null); setSupportOpen(true); }}
            style={({ pressed }) => [styles.stepPrompt, pressed && styles.buttonPressed, actionsDisabled && styles.buttonDisabled]}
          ><Text style={[styles.stepPromptText, { color: accent }]}>Мне трудно начать</Text></Pressable> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${stepSelected && savedStep ? `Начать с шага ${savedStep} задачу` : 'Начать задачу'} ${task.title}`}
            accessibilityState={{ disabled: actionsDisabled, busy: isStarting }}
            disabled={actionsDisabled}
            onPress={stepSelected && savedStep ? startFromStep : () => onStart(task.id)}
            style={({ pressed }) => [
              styles.primaryButton,
              styles.cardStartButton,
              { backgroundColor: accent },
              pressed && styles.buttonPressed,
              actionsDisabled && styles.buttonDisabled,
            ]}
          >
            <Text style={[styles.primaryButtonText, { color: buttonInk }]} maxFontSizeMultiplier={1.2}>{isStarting || modalStartPending ? "Начинаю…" : stepSelected && savedStep ? "Начать с шага" : "Начать"}</Text>
          </Pressable>
          </>
        ) : null}
      </View>
      <Modal visible={supportOpen} transparent animationType="slide" onRequestClose={() => setSupportOpen(false)}>
        <KeyboardAvoidingView testID="difficult-start-keyboard-view" style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View
            testID="difficult-start-scrim"
            pointerEvents="none"
            style={[styles.modalScrim, { backgroundColor: theme.elevationShadow }]}
          />
          <SafeAreaView
            testID="difficult-start-surface"
            edges={["bottom"]}
            style={[styles.safeArea, { backgroundColor: theme.background }]}
          >
          <ScrollView testID="difficult-start-scroll-view" keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.modalCard, { backgroundColor: theme.background }]} accessibilityViewIsModal accessibilityLabel={`Первый маленький шаг для задачи ${task.title}`}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Начать с малого</Text>
            {savedStep && !editing ? (
              <>
                <Text style={[styles.explanation, { color: theme.textSecondary }]}>Вот выбранный вами конкретный первый шаг:</Text>
                <Text style={[styles.stepText, { color: theme.textPrimary }]}>{savedStep}</Text>
                {startError ? <Text accessibilityRole="alert" style={[styles.error, { color: theme.errorPrimary, backgroundColor: theme.errorSoft }]}>{startError}</Text> : null}
                <Pressable accessibilityRole="button" accessibilityLabel={`Начать с маленького шага задачу ${task.title}`} disabled={isStarting || modalStartPending || savePending} accessibilityState={{ disabled: isStarting || modalStartPending || savePending, busy: isStarting || modalStartPending }} onPress={startFromStep} style={[styles.primaryButton, { backgroundColor: theme.brand }, (isStarting || modalStartPending || savePending) && styles.buttonDisabled]}>
                  <Text style={[styles.primaryButtonText, { color: theme.retryText }]}>{isStarting || modalStartPending ? "Начинаю…" : "Начать с этого шага"}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" disabled={savePending || modalStartPending} accessibilityState={{ disabled: savePending || modalStartPending }} onPress={() => { setSaveError(null); setEditing(true); }} style={[styles.secondaryButton, { borderColor: theme.borderSubtle, backgroundColor: theme.surfaceMuted }, (savePending || modalStartPending) && styles.buttonDisabled]}><Text style={[styles.secondaryButtonText, { color: theme.activeBorder }]}>Изменить маленький шаг</Text></Pressable>
              </>
            ) : (
              <>
                <Text style={[styles.explanation, { color: theme.textSecondary }]}>Запишите одно небольшое наблюдаемое действие — не всю задачу.</Text>
                <TextInput autoFocus style={[styles.input, { backgroundColor: savePending ? theme.surfaceMuted : theme.surfacePrimary, borderColor: theme.borderSubtle, color: theme.textPrimary }]} value={draft} onChangeText={(value) => { setSaveError(null); setDraft(value); }} placeholder="Например: открыть документ" placeholderTextColor={theme.textSecondary} selectionColor={theme.brand} maxLength={240} accessibilityLabel="Первый маленький шаг" editable={!savePending} returnKeyType="done" onSubmitEditing={saveFirstStep} />
                {saveError ? <Text accessibilityRole="alert" style={[styles.error, { color: theme.errorPrimary, backgroundColor: theme.errorSoft }]}>{saveError}</Text> : null}
                <Pressable accessibilityRole="button" disabled={!draft.trim() || savePending} accessibilityState={{ disabled: !draft.trim() || savePending, busy: savePending }} onPress={saveFirstStep} style={[styles.primaryButton, { backgroundColor: !draft.trim() || savePending ? theme.surfaceMuted : theme.brand }, (!draft.trim() || savePending) && styles.buttonDisabled]}><Text style={[styles.primaryButtonText, { color: !draft.trim() || savePending ? theme.textSecondary : theme.retryText }]}>{savePending ? "Сохраняю…" : "Сохранить маленький шаг"}</Text></Pressable>
              </>
            )}
            <Pressable accessibilityRole="button" accessibilityLabel="Закрыть помощь с началом" onPress={() => setSupportOpen(false)} style={styles.closeButton}><Text style={[styles.closeText, { color: theme.textSecondary }]}>Закрыть</Text></Pressable>
          </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 12,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8E5FF",
    shadowColor: "#332A7C",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.13,
    shadowRadius: 10,
    elevation: 3,
    overflow: 'hidden',
  },
  accentRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
  },
  embeddedCard: {
    marginHorizontal: 0,
    marginVertical: 0,
  },
  plannedNowCard: {
    borderWidth: 2,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  completionCheck: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  completionCheckMark: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '800',
  },
  eyebrow: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    color: "#6B5BFC",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: {
    marginTop: 3,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "700",
    color: "#211D2E",
  },
  meta: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: "#6B6477",
    opacity: 0.78,
  },
  firstStep: {
    minHeight: 28,
    marginTop: 8,
    paddingHorizontal: 0,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCheckMark: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
  },
  stepValue: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  inlineError: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    marginTop: 10,
    gap: 8,
  },
  primaryButton: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: "#6B5BFC",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  secondaryButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#5A4BE7",
  },
  cardStartButton: {
    minHeight: 44,
    borderRadius: 12,
  },
  stepPrompt: {
    alignSelf: 'flex-start',
    minHeight: 28,
    justifyContent: 'center',
  },
  stepPromptText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.78,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  error: { marginTop: 10, padding: 10, borderRadius: 12, fontSize: 13 },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalScrim: { ...StyleSheet.absoluteFillObject, opacity: 0.55 },
  safeArea: { maxHeight: "90%", borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: "hidden" },
  modalCard: { flexGrow: 1, padding: 24, paddingBottom: 36, gap: 12 },
  modalTitle: { fontSize: 21, fontWeight: "700" },
  explanation: { fontSize: 15, lineHeight: 21 },
  stepText: { fontSize: 18, lineHeight: 25, fontWeight: "600", paddingVertical: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16 },
  closeButton: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  closeText: { fontSize: 15, fontWeight: "600" },
});
