import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
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

type NowCardMode = "current" | "upcoming";

interface Props {
  task: Task;
  mode: NowCardMode;
  onComplete: (taskId: string) => void;
  onStart: (taskId: string) => Promise<void> | void;
  onOpenTask: (task: Task) => void;
  onSaveFirstStep: (taskId: string, firstStep: string) => Promise<Task>;
  isCompleting?: boolean;
  isStarting?: boolean;
  startError?: string | null;
  isSavingFirstStep?: boolean;
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
  onSaveFirstStep,
  isCompleting = false,
  isStarting = false,
  startError = null,
  isSavingFirstStep = false,
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
  const time = task.startTime
    ? formatClockTime(new Date(task.startTime), timeFormat)
    : null;
  const isCurrent = mode === "current";
  const isStarted = task.startedAt !== null;
  const savePending = isSavingFirstStep || localSavePending;
  const actionsDisabled = isStarting || isCompleting || savePending || modalStartPending;

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
    <View style={[styles.card, { backgroundColor: theme.surfacePrimary, borderColor: theme.borderSubtle, shadowColor: theme.elevationShadow }]} accessibilityRole="summary">
      <Text style={[styles.eyebrow, { color: theme.activeBorder }]}>Сейчас</Text>
      <Text style={[styles.context, { color: theme.textSecondary }]}>
        {isStarted ? "Начато" : isCurrent ? "Запланировано сейчас" : "Ближайшее действие"}
      </Text>
      <Text style={[styles.title, { color: theme.textPrimary }]} numberOfLines={2}>
        {task.title}
      </Text>

      <Text style={[styles.meta, { color: theme.textSecondary }]}>
        {time
          ? `Запланировано на ${time}  •  `
          : ""}
        {task.durationMinutes === null
          ? "Длительность: Не знаю"
          : `около ${task.durationMinutes} мин`}
      </Text>
      {startError && !supportOpen && !task.startedAt && !task.completedAt ? <Text accessibilityRole="alert" style={[styles.error, { color: theme.errorPrimary }]}>{startError}</Text> : null}

      <View style={styles.actions}>
        {isStarted ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Завершить задачу ${task.title}`}
              disabled={actionsDisabled}
              accessibilityState={{ disabled: actionsDisabled, busy: isCompleting }}
              onPress={() => onComplete(task.id)}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
                actionsDisabled && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {isCompleting ? "Сохраняю…" : "Завершить"}
              </Text>
            </Pressable>
          </>
        ) : (
          <><Pressable
            accessibilityRole="button"
            accessibilityLabel={`Начать задачу ${task.title}`}
            accessibilityState={{ disabled: actionsDisabled, busy: isStarting }}
            disabled={actionsDisabled}
            onPress={() => onStart(task.id)}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
              actionsDisabled && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.primaryButtonText}>{isStarting ? "Начинаю…" : "Начать"}</Text>
          </Pressable>
          {!task.completedAt && <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Помощь с началом задачи ${task.title}`}
            disabled={actionsDisabled}
            accessibilityState={{ disabled: actionsDisabled }}
            onPress={() => { setDraft(savedStep ?? ""); setEditing(!savedStep); setSaveError(null); setSupportOpen(true); }}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed, actionsDisabled && styles.buttonDisabled]}
          ><Text style={styles.secondaryButtonText}>Мне трудно начать</Text></Pressable>}</>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Изменить задачу ${task.title}`}
          disabled={actionsDisabled}
          accessibilityState={{ disabled: actionsDisabled }}
          onPress={() => onOpenTask(task)}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.buttonPressed,
            actionsDisabled && styles.buttonDisabled,
          ]}
        >
          <Text style={styles.secondaryButtonText}>Изменить план</Text>
        </Pressable>
      </View>
      <Modal visible={supportOpen} transparent animationType="slide" onRequestClose={() => setSupportOpen(false)}>
        <KeyboardAvoidingView testID="difficult-start-keyboard-view" style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
          <ScrollView testID="difficult-start-scroll-view" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalCard} accessibilityViewIsModal accessibilityLabel={`Первый маленький шаг для задачи ${task.title}`}>
            <Text style={styles.modalTitle}>Начать с малого</Text>
            {savedStep && !editing ? (
              <>
                <Text style={styles.explanation}>Вот выбранный вами конкретный первый шаг:</Text>
                <Text style={styles.stepText}>{savedStep}</Text>
                {startError ? <Text accessibilityRole="alert" style={styles.error}>{startError}</Text> : null}
                <Pressable accessibilityRole="button" accessibilityLabel={`Начать с маленького шага задачу ${task.title}`} disabled={isStarting || modalStartPending || savePending} accessibilityState={{ disabled: isStarting || modalStartPending || savePending, busy: isStarting || modalStartPending }} onPress={startFromStep} style={[styles.primaryButton, (isStarting || modalStartPending || savePending) && styles.buttonDisabled]}>
                  <Text style={styles.primaryButtonText}>{isStarting || modalStartPending ? "Начинаю…" : "Начать с этого шага"}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" disabled={savePending || modalStartPending} accessibilityState={{ disabled: savePending || modalStartPending }} onPress={() => { setSaveError(null); setEditing(true); }} style={[styles.secondaryButton, (savePending || modalStartPending) && styles.buttonDisabled]}><Text style={styles.secondaryButtonText}>Изменить маленький шаг</Text></Pressable>
              </>
            ) : (
              <>
                <Text style={styles.explanation}>Запишите одно небольшое наблюдаемое действие — не всю задачу.</Text>
                <TextInput autoFocus style={styles.input} value={draft} onChangeText={(value) => { setSaveError(null); setDraft(value); }} placeholder="Например: открыть документ" placeholderTextColor="#9CA3AF" maxLength={240} accessibilityLabel="Первый маленький шаг" editable={!savePending} returnKeyType="done" onSubmitEditing={saveFirstStep} />
                {saveError ? <Text accessibilityRole="alert" style={styles.error}>{saveError}</Text> : null}
                <Pressable accessibilityRole="button" disabled={!draft.trim() || savePending} accessibilityState={{ disabled: !draft.trim() || savePending, busy: savePending }} onPress={saveFirstStep} style={[styles.primaryButton, (!draft.trim() || savePending) && styles.buttonDisabled]}><Text style={styles.primaryButtonText}>{savePending ? "Сохраняю…" : "Сохранить маленький шаг"}</Text></Pressable>
              </>
            )}
            <Pressable accessibilityRole="button" accessibilityLabel="Закрыть помощь с началом" onPress={() => setSupportOpen(false)} style={styles.closeButton}><Text style={styles.closeText}>Закрыть</Text></Pressable>
          </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginVertical: 12,
    padding: 20,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8E5FF",
    shadowColor: "#332A7C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B5BFC",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  context: {
    marginTop: 6,
    fontSize: 13,
    color: "#7C748F",
  },
  title: {
    marginTop: 8,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "700",
    color: "#211D2E",
  },
  meta: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: "#6B6477",
  },
  actions: {
    marginTop: 18,
    gap: 10,
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
    backgroundColor: "#F3F1FF",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#5A4BE7",
  },
  buttonPressed: {
    opacity: 0.78,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  error: { marginTop: 10, color: "#8A3B3B", fontSize: 13 },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  safeArea: { maxHeight: "90%", backgroundColor: "#FFFFFF", borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  modalCard: { flexGrow: 1, backgroundColor: "#FFFFFF", padding: 24, paddingBottom: 36, gap: 12 },
  modalTitle: { fontSize: 21, fontWeight: "700", color: "#211D2E" },
  explanation: { fontSize: 15, lineHeight: 21, color: "#6B6477" },
  stepText: { fontSize: 18, lineHeight: 25, fontWeight: "600", color: "#211D2E", paddingVertical: 8 },
  input: { borderWidth: 1, borderColor: "#D8D3E8", borderRadius: 12, padding: 12, fontSize: 16, color: "#211D2E" },
  closeButton: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  closeText: { color: "#6B6477", fontSize: 15, fontWeight: "600" },
});
