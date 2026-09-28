import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { RecurrenceEditScope, Task, TaskKind } from "@focus/shared-types";
import {
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
} from "../lib/api/tasks";
import { isFreeTierLimitError, isTaskTimeSlotOccupiedError } from "../lib/api-error";
import { useAuthStore } from "../stores/auth.store";
import { formatWallClock, uses12HourClock } from "../lib/time-format";
import { taskDurationLabel } from "../lib/task-duration";
import {
  calendarDayWallTimeToInstant,
  getLocalHoursMinutes,
  isValidIANATimezone,
  toCanonicalDateParam,
} from "../lib/timezone";
import { normalizeTaskKind } from "../lib/task-kind";
import { FocusDialog, useFocusDialog } from "../components/FocusDialog";
import { useOrbitsTheme, type OrbitsThemeTokens } from "../theme/orbits";

const COLOR_PRESETS = [
  "#6B5BFC",
  "#F97316",
  "#10B981",
  "#3B82F6",
  "#EF4444",
  "#EC4899",
  "#84CC16",
  "#F59E0B",
];

const MAX_MANUAL_TASK_PARTS = 50;
const MAX_TASK_PART_TITLE_LENGTH = 240;

const DURATION_GRID_COLUMNS = [
  [null, 45, 120],
  [15, 60],
  [30, 90],
] as const;

type RecurrencePreset = "none" | "daily" | "weekdays";

const RECURRENCE_SCOPE_LABELS: Record<RecurrenceEditScope, string> = {
  ONLY_THIS: "Только это повторение",
  THIS_AND_FUTURE: "Это и все будущие",
  ENTIRE_SERIES: "Всю серию",
};

const RECURRENCE_RULES: Record<RecurrencePreset, string | null> = {
  none: null,
  daily: "FREQ=DAILY",
  weekdays: "FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR",
};

const RECURRENCE_LABELS: Record<RecurrencePreset, string> = {
  none: "Не повторять",
  daily: "Каждый день",
  weekdays: "Будни (Пн–Пт)",
};

type PartDraft = {
  id?: string;
  draftId: string;
  title: string;
  completed: boolean;
};

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function recurrencePresetFromRule(rule: string | null): RecurrencePreset {
  if (rule === RECURRENCE_RULES.weekdays) return "weekdays";
  if (rule === RECURRENCE_RULES.daily) return "daily";
  return "none";
}

function newCreateRequestId(): string {
  const cryptoApi = globalThis.crypto as (Crypto & { randomUUID?: () => string }) | undefined;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  const bytes = new Uint8Array(16);
  if (cryptoApi?.getRandomValues) cryptoApi.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export default function TaskFormScreen() {
  const router = useRouter();
  const theme = useOrbitsTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { showDialog, dialogProps } = useFocusDialog();
  const params = useLocalSearchParams<{
    task?: string;
    prefillStartTime?: string;
    prefillTitle?: string;
    prefillDurationMinutes?: string;
    prefillKind?: string;
    /** ISO-строка даты выбранного дня — передаётся из today.tsx для корректной инвалидации кэша */
    selectedDate?: string;
    /** Authoritative calendar identity for new Today navigation routes. */
    selectedDateKey?: string;
  }>();

  const profileTimezone = useAuthStore((s) => s.user?.timezone);
  const timeFormat = useAuthStore((s) => s.user?.timeFormat ?? "SYSTEM");

  const legacySelectedDate = useMemo(
    () => (params.selectedDate ? new Date(params.selectedDate) : new Date()),
    [params.selectedDate],
  );
  const selectedDateKey = params.selectedDateKey ??
    toCanonicalDateParam(legacySelectedDate, profileTimezone);

  const today = useMemo(
    () => calendarDayWallTimeToInstant(selectedDateKey, 0, 0, profileTimezone),
    [selectedDateKey, profileTimezone],
  );

  const existingTask: Task | null = useMemo(() => {
    if (!params.task) return null;
    try {
      const parsed = JSON.parse(params.task) as Task;
      return {
        ...parsed,
        startTime: parsed.startTime ? new Date(parsed.startTime) : null,
      };
    } catch {
      return null;
    }
  }, [params.task]);

  const ownerId = useAuthStore((s) => s.user?.id);
  const sessionGeneration = useAuthStore((s) => s.sessionGeneration);
  const mountedRef = useRef(true);
  const saveOperationRef = useRef(0);
  const savingRef = useRef(false);
  const saveContinuationGuardRef = useRef<(() => boolean) | null>(null);
  const ownerRef = useRef(ownerId);
  const sessionRef = useRef(sessionGeneration);
  const taskIdentityRef = useRef(existingTask?.id ?? "new");
  const continuationIdentity = `${ownerId ?? "anonymous"}:${sessionGeneration ?? 0}:${existingTask?.id ?? "new"}`;
  const previousContinuationIdentityRef = useRef(continuationIdentity);
  ownerRef.current = ownerId;
  sessionRef.current = sessionGeneration;
  taskIdentityRef.current = existingTask?.id ?? "new";
  useEffect(() => {
    if (previousContinuationIdentityRef.current === continuationIdentity) return;
    previousContinuationIdentityRef.current = continuationIdentity;
    saveOperationRef.current += 1;
    savingRef.current = false;
    setSaving(false);
  }, [continuationIdentity]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      saveOperationRef.current += 1;
    };
  }, []);

  const isEditMode = !!existingTask;
  const requestedKind = normalizeTaskKind(existingTask?.kind ?? params.prefillKind);
  // BUFFER remains a valid persisted value for legacy records, but new UI
  // creation exposes one unified user-facing REST type.
  const initialKind: TaskKind = existingTask ? requestedKind : requestedKind === "BUFFER" ? "REST" : requestedKind;

  const callerGuard = () => saveContinuationGuardRef.current?.() ?? true;
  const createTask = useCreateTask(today, profileTimezone, callerGuard);
  const updateTask = useUpdateTask(today, profileTimezone, callerGuard);
  const deleteTask = useDeleteTask(today, profileTimezone);

  const [title, setTitle] = useState(
    existingTask?.title ?? params.prefillTitle ?? "",
  );
  const [kind, setKind] = useState<TaskKind>(initialKind);
  const [firstStep, setFirstStep] = useState(existingTask?.firstStep ?? "");

  const initialStartTime =
    existingTask?.startTime ??
    (params.prefillStartTime ? new Date(params.prefillStartTime) : null);

  const editTimezone = existingTask?.seriesTimezone ?? profileTimezone;
  const initialWallClock = initialStartTime && editTimezone &&
    isValidIANATimezone(editTimezone)
    ? getLocalHoursMinutes(initialStartTime, editTimezone)
    : initialStartTime
      ? { hours: initialStartTime.getHours(), minutes: initialStartTime.getMinutes() }
      : null;
  const blankNow = new Date();
  const roundedBlankMinute = roundToStep(blankNow.getMinutes(), 5);
  const blankDefault = {
    hours: (blankNow.getHours() + (roundedBlankMinute === 60 ? 1 : 0)) % 24,
    minutes: roundedBlankMinute % 60,
  };

  const [hasTime, setHasTime] = useState(!!initialStartTime);
  const [wallClockEdited, setWallClockEdited] = useState(false);
  const [hour, setHour] = useState(
    initialWallClock?.hours ?? blankDefault.hours,
  );
  const [minute, setMinute] = useState(
    initialWallClock?.minutes ?? blankDefault.minutes,
  );
  const uses12Hour = uses12HourClock(timeFormat);
  const displayHour = uses12Hour ? hour % 12 || 12 : hour;
  const meridiem = hour < 12 ? "AM" : "PM";

  const prefillDuration = params.prefillDurationMinutes
    ? Number(params.prefillDurationMinutes)
    : null;
  const [durationMinutes, setDurationMinutes] = useState<number | null>(
    existingTask ? existingTask.durationMinutes : prefillDuration,
  );
  const [color, setColor] = useState(existingTask?.color ?? COLOR_PRESETS[0]);
  const [recurrencePreset, setRecurrencePreset] = useState<RecurrencePreset>(
    recurrencePresetFromRule(existingTask?.seriesRecurrenceRule ?? existingTask?.recurrenceRule ?? null),
  );
  const [recurrenceEditScope, setRecurrenceEditScope] = useState<RecurrenceEditScope>(
    existingTask?.seriesId ? "ONLY_THIS" : "ENTIRE_SERIES",
  );
  const initialRecurrencePreset = recurrencePresetFromRule(
    existingTask?.seriesRecurrenceRule ?? existingTask?.recurrenceRule ?? null,
  );
  const stopRecurrenceLabel = recurrenceEditScope === "ENTIRE_SERIES"
    ? "Остановить весь повтор"
    : "Остановить повтор с этого события";

  const draftIdRef = useRef(0);
  const [partsDraft, setPartsDraft] = useState<PartDraft[]>(() =>
    (existingTask?.subTasks ?? []).map((part) => ({
      id: part.id,
      draftId: part.id,
      title: part.title,
      completed: !!part.completedAt,
    })),
  );
  const [subtaskInput, setSubtaskInput] = useState("");
  const [partsFeedback, setPartsFeedback] = useState<string | null>(null);
  const createRequestRef = useRef<{ fingerprint: string; requestId: string } | null>(null);

  const [saving, setSaving] = useState(false);

  const isBlock = kind !== "TASK";
  const blockValidationMessage = isBlock
    ? !hasTime
      ? "Для отдыха укажите время."
      : durationMinutes === null || durationMinutes <= 0
        ? "Для отдыха выберите длительность."
        : null
    : null;

  const partsValidationMessage = useMemo(() => {
    if (partsDraft.length > MAX_MANUAL_TASK_PARTS) {
      return `Можно добавить не больше ${MAX_MANUAL_TASK_PARTS} частей задачи.`;
    }
    if (partsDraft.some((part) => part.title.trim().length === 0)) {
      return "Название каждой части должно содержать хотя бы один символ.";
    }
    if (partsDraft.some((part) => part.title.trim().length > MAX_TASK_PART_TITLE_LENGTH)) {
      return `Название части должно быть не длиннее ${MAX_TASK_PART_TITLE_LENGTH} символов.`;
    }
    return null;
  }, [partsDraft]);
  const partsAtLimit = partsDraft.length >= MAX_MANUAL_TASK_PARTS;
  const newPartTooLong = subtaskInput.trim().length > MAX_TASK_PART_TITLE_LENGTH;
  const addPartDisabled = saving || !subtaskInput.trim() || newPartTooLong || partsAtLimit;
  const partsStatusMessage = partsValidationMessage ??
    (newPartTooLong ? `Название части должно быть не длиннее ${MAX_TASK_PART_TITLE_LENGTH} символов.` : null) ??
    (partsAtLimit ? `Добавлено максимальное количество: ${MAX_MANUAL_TASK_PARTS} частей.` : partsFeedback);
  const saveDisabled = !title.trim() || saving || !!partsValidationMessage || !!blockValidationMessage;

  const draftTaskIdentityRef = useRef(existingTask?.id ?? "new");
  useEffect(() => {
    const nextIdentity = existingTask?.id ?? "new";
    if (draftTaskIdentityRef.current === nextIdentity) return;
    draftTaskIdentityRef.current = nextIdentity;
    draftIdRef.current = 0;
    setTitle(existingTask?.title ?? params.prefillTitle ?? "");
    const nextRequestedKind = normalizeTaskKind(existingTask?.kind ?? params.prefillKind);
    setKind(existingTask ? nextRequestedKind : nextRequestedKind === "BUFFER" ? "REST" : nextRequestedKind);
    setFirstStep(existingTask?.firstStep ?? "");
    setHasTime(!!initialStartTime);
    setWallClockEdited(false);
    setHour(initialWallClock?.hours ?? blankDefault.hours);
    setMinute(initialWallClock?.minutes ?? blankDefault.minutes);
    setDurationMinutes(existingTask ? existingTask.durationMinutes : prefillDuration);
    setColor(existingTask?.color ?? COLOR_PRESETS[0]);
    setRecurrencePreset(initialRecurrencePreset);
    setRecurrenceEditScope(existingTask?.seriesId ? "ONLY_THIS" : "ENTIRE_SERIES");
    setPartsDraft((existingTask?.subTasks ?? []).map((part) => ({
      id: part.id,
      draftId: part.id,
      title: part.title,
      completed: !!part.completedAt,
    })));
    setSubtaskInput("");
    setPartsFeedback(null);
    createRequestRef.current = null;
  }, [existingTask?.id]);

  function selectKind(nextKind: TaskKind) {
    if (nextKind === kind) return;
    if (isEditMode && (kind === "TASK" || nextKind === "TASK")) {
      showDialog({
        title: "Тип нельзя изменить",
        message: "В этой версии задачу нельзя преобразовать в отдых и наоборот.",
      });
      return;
    }
    const hasTaskOwnedDraftData = firstStep.trim() ||
      color !== COLOR_PRESETS[0] ||
      recurrencePreset !== "none" ||
      partsDraft.length > 0 ||
      subtaskInput.trim();
    if (nextKind !== "TASK" && kind === "TASK" && hasTaskOwnedDraftData) {
      showDialog({
        title: "Сначала уберите данные задачи",
        message: "Первый шаг, цвет, повтор и части доступны только задаче. Мы не удаляем их автоматически.",
      });
      return;
    }
    setKind(nextKind);
  }

  function adjustHour(delta: number) {
    setWallClockEdited(true);
    setHour((h) => (h + delta + 24) % 24);
  }

  function toggleMeridiem() {
    setWallClockEdited(true);
    setHour((h) => (h + 12) % 24);
  }

  function adjustMinute(delta: number) {
    setWallClockEdited(true);
    setMinute((m) => (m + delta + 60) % 60);
  }

  function addSubtaskFromInput() {
    const value = subtaskInput.trim();
    if (!value) return;
    if (partsDraft.length >= MAX_MANUAL_TASK_PARTS) {
      setPartsFeedback(`Можно добавить не больше ${MAX_MANUAL_TASK_PARTS} частей задачи.`);
      return;
    }
    if (value.length > MAX_TASK_PART_TITLE_LENGTH) {
      setPartsFeedback(`Название части должно быть не длиннее ${MAX_TASK_PART_TITLE_LENGTH} символов.`);
      return;
    }
    setPartsDraft((prev) => [...prev, {
      draftId: `new-${++draftIdRef.current}`,
      title: value,
      completed: false,
    }]);
    setSubtaskInput("");
    setPartsFeedback(null);
  }

  function updatePart(draftId: string, title: string) {
    setPartsDraft((prev) => prev.map((part) => part.draftId === draftId ? { ...part, title } : part));
    setPartsFeedback(null);
  }

  function togglePart(draftId: string) {
    setPartsDraft((prev) => prev.map((part) => part.draftId === draftId ? { ...part, completed: !part.completed } : part));
  }

  function removePart(draftId: string) {
    setPartsDraft((prev) => prev.filter((part) => part.draftId !== draftId));
    setPartsFeedback(null);
  }

  async function handleSave() {
    if (!title.trim() || partsValidationMessage || blockValidationMessage || savingRef.current) {
      if (partsValidationMessage) setPartsFeedback(partsValidationMessage);
      return;
    }
    savingRef.current = true;
    const operation = ++saveOperationRef.current;
    const owner = ownerRef.current;
    const session = sessionRef.current;
    const taskIdentity = taskIdentityRef.current;
    const isCurrent = () => mountedRef.current && saveOperationRef.current === operation &&
      ownerRef.current === owner && sessionRef.current === session && taskIdentityRef.current === taskIdentity;
    saveContinuationGuardRef.current = isCurrent;
    setSaving(true);

    const recurrenceAnchorKey = existingTask?.seriesStartTime
      ? toCanonicalDateParam(new Date(existingTask.seriesStartTime), existingTask.seriesTimezone)
      : selectedDateKey;
    const occurrenceDateKey = existingTask?.recurrenceDateKey ?? selectedDateKey;
    const editedDateKey = existingTask?.seriesId && recurrenceEditScope === "ENTIRE_SERIES"
      ? recurrenceAnchorKey
      : occurrenceDateKey;
    const unchangedStartTime = existingTask?.seriesId &&
      recurrenceEditScope === "ENTIRE_SERIES" && existingTask.seriesStartTime
      ? new Date(existingTask.seriesStartTime)
      : initialStartTime;
    const startTimeIso = hasTime
      ? unchangedStartTime && !wallClockEdited
        ? unchangedStartTime.toISOString()
        : calendarDayWallTimeToInstant(
            existingTask?.seriesId ? editedDateKey : selectedDateKey,
            hour, minute, existingTask?.seriesTimezone ?? profileTimezone,
          ).toISOString()
      : null;

    const dto = isBlock
      ? {
          title: title.trim(),
          kind,
          startTime: startTimeIso,
          durationMinutes,
        }
      : {
          title: title.trim(),
          kind,
          firstStep: firstStep.trim() || null,
          startTime: startTimeIso,
          durationMinutes,
          color,
          isRecurring: recurrencePreset !== "none",
          recurrenceRule: RECURRENCE_RULES[recurrencePreset],
          deviceTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          editRecurrenceAnchor: !!existingTask?.seriesId && wallClockEdited,
          editRecurrencePattern: !!existingTask?.seriesId && recurrencePreset !== initialRecurrencePreset,
          ...(existingTask?.seriesId && { recurrenceEditScope }),
          ...(recurrencePreset === "none" && {
            subTasks: partsDraft.map(({ id, title: partTitle, completed }) => ({
              ...(id ? { id } : {}),
              title: partTitle.trim(),
              completed,
            })),
          }),
        };

    try {
      if (isEditMode && existingTask) {
        await updateTask.mutateAsync({
          id: existingTask.id,
          dto,
        });
      } else {
        const fingerprint = JSON.stringify({ ownerId, dto });
        if (createRequestRef.current?.fingerprint !== fingerprint) {
          createRequestRef.current = { fingerprint, requestId: newCreateRequestId() };
        }
        await createTask.mutateAsync({
          ...dto,
          createRequestId: createRequestRef.current.requestId,
        });
      }
      if (isCurrent()) router.back();
    } catch (err) {
      if (!isCurrent()) return;
      if (isFreeTierLimitError(err)) router.replace("/paywall");
      else if (isTaskTimeSlotOccupiedError(err)) {
        showDialog({
          title: "Это время уже занято",
          message: "Выберите другое время или измените длительность.",
        });
      }
      else {
        showDialog({
          title: "Не удалось сохранить",
          message: "Проверьте соединение и попробуйте снова",
        });
      }
    } finally {
      if (isCurrent()) {
        savingRef.current = false;
        setSaving(false);
      }
    }
  }

  function handleDelete() {
    if (!existingTask) return;
    const wholeSeries = !!existingTask.seriesId || existingTask.isRecurring;
    const deleteLabel = isBlock ? "Удалить отдых?" : "Удалить задачу?";
    showDialog({
      title: wholeSeries ? "Удалить весь повтор?" : deleteLabel,
      message: wholeSeries
        ? "Будут удалены все задачи этого повтора."
        : existingTask.title,
      actions: [
        { text: "Отмена", style: "cancel" },
        {
          text: "Удалить",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTask.mutateAsync(existingTask.id);
              router.back();
            } catch {
              showDialog({ title: "Не удалось удалить", message: "Попробуйте снова" });
            }
          },
        },
      ],
    });
  }

  return (
    <>
    <StatusBar style={theme.name === "dark" ? "light" : "dark"} />
    <ScrollView
      testID="task-form-screen"
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
    >
      <View testID="task-kind-section" style={styles.kindSection}>
        <Text style={[styles.sectionLabel, styles.kindSectionLabel]}>Тип записи</Text>
        <View testID="task-kind-group" accessibilityRole="radiogroup" style={styles.row}>
          {([
            ["TASK", "Задача"],
            ["REST", "Отдых"],
          ] as const).map(([value, label]) => {
            const incompatibleEdit = isEditMode && (kind === "TASK" ? value !== "TASK" : value === "TASK");
            const selected = value === "TASK" ? kind === "TASK" : isBlock;
            return (
              <Pressable
                key={value}
                testID={`task-kind-${value.toLowerCase()}`}
                accessibilityRole="radio"
                accessibilityLabel={label}
                accessibilityState={{ selected, disabled: incompatibleEdit || saving }}
                disabled={incompatibleEdit || saving}
                style={({ pressed }) => [
                  styles.toggleChip,
                  selected && styles.toggleChipActive,
                  pressed && styles.controlPressed,
                  (incompatibleEdit || saving) && styles.disabledChip,
                ]}
                onPress={() => selectKind(value === "REST" && kind === "BUFFER" ? "BUFFER" : value)}
              >
                <Text style={[styles.toggleChipText, selected && styles.toggleChipTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <TextInput
        testID="task-title-input"
        style={styles.titleInput}
        placeholder={isBlock ? "Название блока" : "Название задачи"}
        placeholderTextColor={theme.textSecondary}
        selectionColor={theme.brand}
        value={title}
        onChangeText={setTitle}
        autoFocus={!isEditMode}
      />

      {!isBlock && <>
        <Text style={styles.sectionLabel}>Первый маленький шаг</Text>
        <Text style={styles.supportingText}>Одно конкретное действие, с которого можно начать, а не вся задача.</Text>
        <TextInput
          testID="task-first-step-input"
          style={styles.firstStepInput}
          value={firstStep}
          onChangeText={setFirstStep}
          placeholder="Например: открыть документ"
          placeholderTextColor={theme.textSecondary}
          selectionColor={theme.brand}
          maxLength={240}
          accessibilityLabel="Первый маленький шаг"
          editable={!saving}
          returnKeyType="done"
        />
      </>}

      {/* Время */}
      <Text style={styles.sectionLabel}>Время</Text>
      <View style={styles.row}>
        <Pressable
          testID="task-time-untimed"
          accessibilityRole="radio"
          accessibilityLabel="Без времени"
          accessibilityState={{ selected: !hasTime, disabled: isBlock || saving }}
          disabled={isBlock || saving}
          style={({ pressed }) => [
            styles.toggleChip,
            !hasTime && styles.toggleChipActive,
            pressed && styles.controlPressed,
            (isBlock || saving) && styles.disabledChip,
          ]}
          onPress={() => {
            if (recurrencePreset !== "none") {
              setRecurrencePreset("none");
              showDialog({ title: "Повтор выключен", message: "Для повторяющейся задачи нужно указать время." });
            }
            setHasTime(false);
          }}
        >
          <Text
            style={[
              styles.toggleChipText,
              !hasTime && styles.toggleChipTextActive,
            ]}
          >
            Без времени
          </Text>
        </Pressable>
        <Pressable
          testID="task-time-timed"
          accessibilityRole="radio"
          accessibilityLabel="Указать время"
          accessibilityState={{ selected: hasTime }}
          style={({ pressed }) => [styles.toggleChip, hasTime && styles.toggleChipActive, pressed && styles.controlPressed]}
          onPress={() => setHasTime(true)}
        >
          <Text style={[styles.toggleChipText, hasTime && styles.toggleChipTextActive]}>
            Указать время
          </Text>
        </Pressable>
      </View>
      {isBlock && <Text style={styles.supportingText}>Отдых занимает выбранное время и требует известной длительности.</Text>}

      {hasTime && (
        <View>
          <Text testID="task-time-display" style={styles.timePreview}>{formatWallClock(hour, minute, timeFormat)}</Text>
          <View style={styles.timeStepperRow}>
            <View style={styles.stepper}>
              <Pressable accessibilityRole="button" accessibilityLabel="Уменьшить час" accessibilityState={{ disabled: saving }} disabled={saving} onPress={() => adjustHour(-1)} style={({ pressed }) => [styles.stepperButton, pressed && styles.controlPressed, saving && styles.disabledChip]}><Text style={styles.stepperButtonText}>−</Text></Pressable>
              <Text testID="task-hour-value" accessibilityLabel={`Час ${displayHour}`} style={styles.stepperValue}>{uses12Hour ? displayHour : String(displayHour).padStart(2, '0')}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Увеличить час" accessibilityState={{ disabled: saving }} disabled={saving} onPress={() => adjustHour(1)} style={({ pressed }) => [styles.stepperButton, pressed && styles.controlPressed, saving && styles.disabledChip]}><Text style={styles.stepperButtonText}>+</Text></Pressable>
            </View>
            <Text style={styles.timeColon}>:</Text>
            <View style={styles.stepper}>
              <Pressable accessibilityRole="button" accessibilityLabel="Уменьшить минуты" accessibilityState={{ disabled: saving }} disabled={saving} onPress={() => adjustMinute(-5)} style={({ pressed }) => [styles.stepperButton, pressed && styles.controlPressed, saving && styles.disabledChip]}><Text style={styles.stepperButtonText}>−</Text></Pressable>
              <Text testID="task-minute-value" accessibilityLabel={`Минуты ${minute}`} style={styles.stepperValue}>{String(minute).padStart(2, '0')}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Увеличить минуты" accessibilityState={{ disabled: saving }} disabled={saving} onPress={() => adjustMinute(5)} style={({ pressed }) => [styles.stepperButton, pressed && styles.controlPressed, saving && styles.disabledChip]}><Text style={styles.stepperButtonText}>+</Text></Pressable>
            </View>
            {uses12Hour && <View accessibilityRole="radiogroup" style={styles.meridiemGroup}>{(['AM','PM'] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={`Выбрать ${value}`} accessibilityState={{ selected: meridiem === value, disabled: saving }} disabled={saving || meridiem === value} onPress={toggleMeridiem} style={({ pressed }) => [styles.meridiemButton, meridiem === value && styles.meridiemButtonActive, pressed && styles.controlPressed, saving && styles.disabledChip]}><Text style={[styles.meridiemText, meridiem === value && styles.meridiemTextActive]}>{value}</Text></Pressable>)}</View>}
          </View>
        </View>
      )}

      {/* Длительность */}
      <Text style={styles.sectionLabel}>Длительность</Text>
      <View testID="duration-grid" style={styles.durationGrid}>
        {DURATION_GRID_COLUMNS.map((column, columnIndex) => (
          <View key={columnIndex} testID={`duration-column-${columnIndex + 1}`} style={styles.durationColumn}>
            {column.filter((mins) => !isBlock || mins !== null).map((mins) => (
              <Pressable
                key={mins ?? "unknown"}
                testID={`duration-chip-${mins ?? "unknown"}`}
                accessibilityRole="button"
                accessibilityLabel={taskDurationLabel(mins)}
                accessibilityState={{ selected: durationMinutes === mins }}
                style={({ pressed }) => [
                  styles.chip,
                  styles.durationChip,
                  durationMinutes === mins && styles.chipActive,
                  pressed && styles.controlPressed,
                ]}
                onPress={() => setDurationMinutes(mins)}
              >
                <Text
                  style={[
                    styles.chipText,
                    styles.durationChipText,
                    durationMinutes === mins && styles.chipTextActive,
                  ]}
                >
                  {taskDurationLabel(mins)}
                </Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>
      {!!blockValidationMessage && (
        <Text accessibilityRole="alert" style={styles.validationText}>{blockValidationMessage}</Text>
      )}

      {/* Цвет */}
      {!isBlock && <>
      <Text style={styles.sectionLabel}>Цвет</Text>
      <View style={styles.chipsWrap}>
        {COLOR_PRESETS.map((c) => (
          <Pressable
            key={c}
            testID={`color-swatch-${c}`}
            accessibilityRole="radio"
            accessibilityLabel={`Цвет ${c}`}
            accessibilityState={{ selected: color === c }}
            onPress={() => setColor(c)}
            style={[
              styles.colorSwatch,
              { backgroundColor: c },
              color === c && styles.colorSwatchActive,
            ]}
          />
        ))}
      </View>

      {isEditMode && existingTask?.seriesId && (
        <>
          <Text style={styles.sectionLabel}>Область изменения</Text>
          <View accessibilityRole="radiogroup" style={styles.scopeGroup}>
            {(Object.keys(RECURRENCE_SCOPE_LABELS) as RecurrenceEditScope[]).map((scope) => (
              <Pressable
                key={scope}
                testID={`recurrence-scope-${scope.toLowerCase()}`}
                accessibilityRole="radio"
                accessibilityLabel={RECURRENCE_SCOPE_LABELS[scope]}
                accessibilityState={{ selected: recurrenceEditScope === scope, disabled: saving }}
                disabled={saving}
                style={({ pressed }) => [
                  styles.scopeChip,
                  recurrenceEditScope === scope && styles.chipActive,
                  pressed && styles.controlPressed,
                ]}
                onPress={() => setRecurrenceEditScope(scope)}
              >
                <Text style={[styles.chipText, recurrenceEditScope === scope && styles.chipTextActive]}>
                  {RECURRENCE_SCOPE_LABELS[scope]}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.supportingText}>
            {recurrenceEditScope === "ONLY_THIS"
              ? "Название, время и длительность изменятся только у выбранного события."
              : recurrenceEditScope === "THIS_AND_FUTURE"
                ? "Прошлые события сохранятся, а с выбранной даты начнётся обновлённый повтор."
                : "Изменения применятся ко всему повтору, кроме уже начатых и завершённых событий."}
          </Text>
        </>
      )}

      {/* Повтор */}
      <Text style={styles.sectionLabel}>Повтор</Text>
      <View style={styles.chipsWrap}>
        {(Object.keys(RECURRENCE_LABELS) as RecurrencePreset[]).map((preset) => (
          <Pressable
            key={preset}
            testID={`recurrence-chip-${preset}`}
            accessibilityRole="radio"
            accessibilityLabel={preset === "none" && existingTask?.seriesId ? stopRecurrenceLabel : RECURRENCE_LABELS[preset]}
            accessibilityState={{ selected: recurrencePreset === preset }}
            style={({ pressed }) => [styles.chip, recurrencePreset === preset && styles.chipActive, pressed && styles.controlPressed]}
            onPress={() => {
              if (preset !== "none" && !hasTime) {
                showDialog({ title: "Укажите время", message: "Повтору нужно конкретное время начала." });
                return;
              }
              if (preset !== "none" && partsDraft.length) {
                showDialog({ title: "Сначала уберите части", message: "Части задачи недоступны для повторяющихся задач." });
                return;
              }
              if (existingTask?.seriesId && recurrenceEditScope === "ONLY_THIS" &&
                preset !== initialRecurrencePreset) {
                setRecurrenceEditScope("THIS_AND_FUTURE");
              }
              setRecurrencePreset(preset);
            }}
          >
            <Text
              style={[styles.chipText, recurrencePreset === preset && styles.chipTextActive]}
            >
              {preset === "none" && existingTask?.seriesId ? stopRecurrenceLabel : RECURRENCE_LABELS[preset]}
            </Text>
          </Pressable>
        ))}
      </View>
      {isEditMode && existingTask?.isRecurring && !existingTask?.seriesId && (
        <Text style={styles.supportingText}>
          Изменения применятся ко всему повтору, включая будущие задачи.
        </Text>
      )}

      {recurrencePreset !== "none" ? (
        <Text style={styles.supportingText}>Части задачи недоступны для повторяющихся задач.</Text>
      ) : <>
      {/* User-authored task parts stay local until the parent is saved. */}
      <Text style={styles.sectionLabel}>Части задачи</Text>
      <Text style={styles.supportingText}>Необязательно. Части сохранятся вместе с этой задачей.</Text>
      {partsDraft.map((part) => (
        <View key={part.draftId} style={styles.subtaskRow}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel={`Отметить часть: ${part.title}`}
            accessibilityState={{ checked: part.completed, disabled: saving }}
            disabled={saving}
            onPress={() => togglePart(part.draftId)}
            style={styles.partCheck}
          >
            <Text style={[styles.partCheckText, part.completed && styles.partCheckTextCompleted]}>{part.completed ? "✓" : ""}</Text>
          </Pressable>
          <TextInput
            accessibilityLabel={`Название части: ${part.title}`}
            accessibilityHint={part.title.trim().length === 0
              ? "Название части не может быть пустым"
              : part.title.trim().length > MAX_TASK_PART_TITLE_LENGTH
                ? `Название части должно быть не длиннее ${MAX_TASK_PART_TITLE_LENGTH} символов`
                : undefined}
            editable={!saving}
            selectionColor={theme.brand}
            value={part.title}
            onChangeText={(value) => updatePart(part.draftId, value)}
            maxLength={MAX_TASK_PART_TITLE_LENGTH}
            style={[
              styles.subtaskInput,
              styles.partTitleInput,
              part.completed && styles.partCompletedText,
              (part.title.trim().length === 0 || part.title.trim().length > MAX_TASK_PART_TITLE_LENGTH) && styles.invalidInput,
            ]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Удалить часть: ${part.title}`}
            accessibilityState={{ disabled: saving }}
            disabled={saving}
            onPress={() => removePart(part.draftId)}
            style={({ pressed }) => [styles.subtaskRemoveButton, pressed && styles.deleteButtonPressed]}
          >
            <Text style={styles.subtaskRemove}>×</Text>
          </Pressable>
        </View>
      ))}

      <View style={styles.subtaskInputRow}>
        <TextInput
          style={styles.subtaskInput}
          placeholder="Добавить часть"
          placeholderTextColor={theme.textSecondary}
          selectionColor={theme.brand}
          value={subtaskInput}
          onChangeText={setSubtaskInput}
          onSubmitEditing={addSubtaskFromInput}
          editable={!saving}
          accessibilityLabel="Новая часть задачи"
          accessibilityHint={partsAtLimit
            ? `Достигнут предел: ${MAX_MANUAL_TASK_PARTS} частей`
            : `Не больше ${MAX_TASK_PART_TITLE_LENGTH} символов`}
          maxLength={MAX_TASK_PART_TITLE_LENGTH}
          returnKeyType="done"
        />
        <Pressable
          testID="subtask-add-button"
          onPress={addSubtaskFromInput}
          style={({ pressed }) => [styles.subtaskAddButton, pressed && styles.controlPressed, addPartDisabled && styles.disabledChip]}
          accessibilityRole="button"
          accessibilityLabel="Добавить часть задачи"
          accessibilityHint={partsAtLimit ? `Достигнут предел: ${MAX_MANUAL_TASK_PARTS} частей` : undefined}
          accessibilityState={{ disabled: addPartDisabled }}
          disabled={addPartDisabled}
        >
          <Text style={styles.subtaskAddButtonText}>+</Text>
        </Pressable>
      </View>
      {!!partsStatusMessage && (
        <Text accessibilityRole="alert" style={styles.validationText}>{partsStatusMessage}</Text>
      )}
      </>}
      </>}

      {/* Действия */}
      <Pressable
        testID="task-save-button"
        accessibilityRole="button"
        accessibilityLabel={isBlock ? "Сохранить отдых" : "Сохранить задачу"}
        accessibilityHint={blockValidationMessage ?? partsValidationMessage ?? undefined}
        accessibilityState={{ busy: saving, disabled: saveDisabled }}
        style={({ pressed }) => [
          styles.saveButton,
          pressed && !saveDisabled && styles.saveButtonPressed,
          saveDisabled && styles.saveButtonDisabled,
        ]}
        onPress={handleSave}
        disabled={saveDisabled}
      >
        <Text style={[styles.saveButtonText, saveDisabled && styles.saveButtonTextDisabled]}>
          {saving ? "Сохранение…" : "Сохранить"}
        </Text>
      </Pressable>

      {isEditMode && (
        <Pressable
          testID="task-delete-button"
          style={({ pressed }) => [styles.deleteButton, pressed && styles.deleteButtonPressed]}
          onPress={handleDelete}
        >
          <Text style={styles.deleteButtonText}>
            {existingTask?.seriesId || existingTask?.isRecurring
              ? "Удалить весь повтор"
              : isBlock
                ? "Удалить отдых"
                : "Удалить задачу"}
          </Text>
        </Pressable>
      )}
    </ScrollView>
    <FocusDialog {...dialogProps} />
    </>
  );
}

function createStyles(theme: OrbitsThemeTokens) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  content: { padding: 20, paddingBottom: 48, backgroundColor: theme.background },
  titleInput: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.textPrimary,
    backgroundColor: theme.surfacePrimary,
    borderWidth: 1,
    borderColor: theme.borderSubtle,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.textSecondary,
    marginTop: 16,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  kindSection: { marginTop: 4, marginBottom: 16 },
  kindSectionLabel: { marginTop: 0 },
  supportingText: { fontSize: 13, lineHeight: 18, color: theme.textSecondary, marginBottom: 8 },
  scopeGroup: { gap: 8, marginBottom: 8 },
  scopeChip: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.borderSubtle,
    backgroundColor: theme.surfacePrimary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: "center",
  },
  disabledChip: { opacity: 0.45 },
  controlPressed: { backgroundColor: theme.activeSurface, borderColor: theme.activeBorder },
  firstStepInput: {
    borderWidth: 1, borderColor: theme.borderSubtle, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: theme.textPrimary,
    backgroundColor: theme.surfacePrimary,
  },
  row: { flexDirection: "row", gap: 8 },
  toggleChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.borderSubtle,
  },
  toggleChipActive: { backgroundColor: theme.activeSurface, borderColor: theme.activeBorder },
  toggleChipText: { fontSize: 13, color: theme.textSecondary, fontWeight: "600" },
  toggleChipTextActive: { color: theme.activeSurfaceText },
  timePreview: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.textPrimary,
    marginBottom: 8,
  },
  meridiemGroup: { gap: 4, marginLeft: 8 },
  meridiemButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: theme.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.borderSubtle,
  },
  meridiemButtonActive: { backgroundColor: theme.activeSurface, borderColor: theme.activeBorder },
  meridiemText: { color: theme.textPrimary, fontWeight: "600" },
  meridiemTextActive: { color: theme.activeSurfaceText },
  timeStepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  stepper: { flexDirection: "row", alignItems: "center" },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperButtonText: { fontSize: 18, color: theme.textPrimary, fontWeight: "600" },
  stepperValue: {
    fontSize: 22,
    fontWeight: "700",
    color: theme.textPrimary,
    width: 44,
    textAlign: "center",
  },
  timeColon: {
    fontSize: 22,
    fontWeight: "700",
    color: theme.textPrimary,
    marginHorizontal: 4,
  },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  durationGrid: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  durationColumn: { flex: 1, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.borderSubtle,
  },
  durationChip: {
    alignSelf: "stretch",
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { backgroundColor: theme.activeSurface, borderColor: theme.activeBorder },
  chipText: { fontSize: 13, color: theme.textSecondary, fontWeight: "600" },
  durationChipText: { flexShrink: 1, textAlign: "center" },
  chipTextActive: { color: theme.activeSurfaceText },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: theme.background,
  },
  colorSwatchActive: { borderColor: theme.activeBorder },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.activeBorder,
  },
  presetChipText: { fontSize: 13, color: theme.brand, fontWeight: "600" },
  subtaskRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderSubtle,
  },
  subtaskText: { fontSize: 14, color: theme.textPrimary },
  partCheck: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  partCheckText: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: theme.borderSubtle,
    borderRadius: 5,
    textAlign: "center",
    lineHeight: 22,
    color: theme.textSecondary,
    backgroundColor: theme.surfacePrimary,
    fontWeight: "700",
  },
  partCheckTextCompleted: {
    color: theme.completionPrimary,
    backgroundColor: theme.completionSoft,
    borderColor: theme.completionPrimary,
  },
  partTitleInput: { paddingVertical: 8 },
  partCompletedText: { textDecorationLine: "line-through", color: theme.completionPrimary, backgroundColor: theme.completionSoft },
  subtaskRemoveButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  subtaskRemove: { fontSize: 18, color: theme.textSecondary, paddingHorizontal: 8 },
  subtaskInputRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    alignItems: "center",
  },
  subtaskInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.borderSubtle,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.textPrimary,
    backgroundColor: theme.surfacePrimary,
  },
  invalidInput: { borderColor: theme.errorPrimary, backgroundColor: theme.errorSoft },
  validationText: { color: theme.errorPrimary, fontSize: 13, lineHeight: 18, marginTop: 6 },
  subtaskAddButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: theme.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  subtaskAddButtonText: { fontSize: 20, color: theme.textPrimary },
  saveButton: {
    marginTop: 28,
    backgroundColor: theme.brand,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveButtonPressed: { backgroundColor: theme.brandPressed },
  saveButtonDisabled: { backgroundColor: theme.surfaceMuted, borderWidth: 1, borderColor: theme.borderSubtle },
  saveButtonText: { color: theme.retryText, fontSize: 16, fontWeight: "700" },
  saveButtonTextDisabled: { color: theme.textSecondary },
  deleteButton: { marginTop: 16, paddingVertical: 12, alignItems: "center", borderRadius: 12 },
  deleteButtonPressed: { backgroundColor: theme.errorSoft },
  deleteButtonText: { color: theme.errorPrimary, fontSize: 14, fontWeight: "600" },
});
}
