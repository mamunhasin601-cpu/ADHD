import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Task } from "@focus/shared-types";
import {
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
} from "../lib/api/tasks";
import { isFreeTierLimitError } from "../lib/api-error";
import { useAuthStore } from "../stores/auth.store";
import { formatWallClock, uses12HourClock } from "../lib/time-format";
import { TASK_DURATION_PRESETS, taskDurationLabel } from "../lib/task-duration";
import {
  calendarDayWallTimeToInstant,
  getLocalHoursMinutes,
  isValidIANATimezone,
  toCanonicalDateParam,
} from "../lib/timezone";

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

type RecurrencePreset = "none" | "daily" | "weekdays";

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
  const params = useLocalSearchParams<{
    task?: string;
    prefillStartTime?: string;
    prefillTitle?: string;
    prefillDurationMinutes?: string;
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

  const callerGuard = () => saveContinuationGuardRef.current?.() ?? true;
  const createTask = useCreateTask(today, profileTimezone, callerGuard);
  const updateTask = useUpdateTask(today, profileTimezone, callerGuard);
  const deleteTask = useDeleteTask(today, profileTimezone);

  const [title, setTitle] = useState(
    existingTask?.title ?? params.prefillTitle ?? "",
  );
  const [firstStep, setFirstStep] = useState(existingTask?.firstStep ?? "");

  const initialStartTime =
    (existingTask?.seriesId && existingTask.seriesStartTime
      ? new Date(existingTask.seriesStartTime)
      : existingTask?.startTime) ??
    (params.prefillStartTime ? new Date(params.prefillStartTime) : null);

  const editTimezone = existingTask?.seriesTimezone ?? profileTimezone;
  const initialWallClock = initialStartTime && editTimezone &&
    isValidIANATimezone(editTimezone) && params.selectedDateKey
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
  const initialRecurrencePreset = recurrencePresetFromRule(
    existingTask?.seriesRecurrenceRule ?? existingTask?.recurrenceRule ?? null,
  );

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
  const saveDisabled = !title.trim() || saving || !!partsValidationMessage;

  const draftTaskIdentityRef = useRef(existingTask?.id ?? "new");
  useEffect(() => {
    const nextIdentity = existingTask?.id ?? "new";
    if (draftTaskIdentityRef.current === nextIdentity) return;
    draftTaskIdentityRef.current = nextIdentity;
    draftIdRef.current = 0;
    setTitle(existingTask?.title ?? params.prefillTitle ?? "");
    setFirstStep(existingTask?.firstStep ?? "");
    setHasTime(!!initialStartTime);
    setWallClockEdited(false);
    setHour(initialWallClock?.hours ?? blankDefault.hours);
    setMinute(initialWallClock?.minutes ?? blankDefault.minutes);
    setDurationMinutes(existingTask ? existingTask.durationMinutes : prefillDuration);
    setColor(existingTask?.color ?? COLOR_PRESETS[0]);
    setRecurrencePreset(initialRecurrencePreset);
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
    if (!title.trim() || partsValidationMessage || savingRef.current) {
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
    const startTimeIso = hasTime
      ? initialStartTime && !wallClockEdited
        ? initialStartTime.toISOString()
        : calendarDayWallTimeToInstant(
            existingTask?.seriesId ? recurrenceAnchorKey : selectedDateKey,
            hour, minute, existingTask?.seriesTimezone ?? profileTimezone,
          ).toISOString()
      : null;

    const dto = {
      title: title.trim(),
      firstStep: firstStep.trim() || null,
      startTime: startTimeIso,
      durationMinutes,
      color,
      isRecurring: recurrencePreset !== "none",
      recurrenceRule: RECURRENCE_RULES[recurrencePreset],
      deviceTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      editRecurrenceAnchor: !!existingTask?.seriesId && wallClockEdited,
      editRecurrencePattern: !!existingTask?.seriesId && recurrencePreset !== initialRecurrencePreset,
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
      else {
        Alert.alert(
          "Не удалось сохранить",
          "Проверьте соединение и попробуйте снова",
        );
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
    Alert.alert(wholeSeries ? "Удалить весь повтор?" : "Удалить задачу?", wholeSeries
      ? "Будут удалены все задачи этого повтора."
      : existingTask.title, [
      { text: "Отмена", style: "cancel" },
      {
        text: "Удалить",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteTask.mutateAsync(existingTask.id);
            router.back();
          } catch {
            Alert.alert("Не удалось удалить", "Попробуйте снова");
          }
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TextInput
        style={styles.titleInput}
        placeholder="Название задачи"
        placeholderTextColor="#9CA3AF"
        value={title}
        onChangeText={setTitle}
        autoFocus={!isEditMode}
      />

      <Text style={styles.sectionLabel}>Первый маленький шаг</Text>
      <Text style={styles.supportingText}>Одно конкретное действие, с которого можно начать, а не вся задача.</Text>
      <TextInput
        style={styles.firstStepInput}
        value={firstStep}
        onChangeText={setFirstStep}
        placeholder="Например: открыть документ"
        placeholderTextColor="#9CA3AF"
        maxLength={240}
        accessibilityLabel="Первый маленький шаг"
        editable={!saving}
        returnKeyType="done"
      />

      {/* Время */}
      <Text style={styles.sectionLabel}>Время</Text>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="radio"
          accessibilityLabel="Без времени"
          accessibilityState={{ selected: !hasTime }}
          style={[styles.toggleChip, !hasTime && styles.toggleChipActive]}
          onPress={() => {
            if (recurrencePreset !== "none") {
              setRecurrencePreset("none");
              Alert.alert("Повтор выключен", "Для повторяющейся задачи нужно указать время.");
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
          accessibilityRole="radio"
          accessibilityLabel="Указать время"
          accessibilityState={{ selected: hasTime }}
          style={[styles.toggleChip, hasTime && styles.toggleChipActive]}
          onPress={() => setHasTime(true)}
        >
          <Text style={[styles.toggleChipText, hasTime && styles.toggleChipTextActive]}>
            Указать время
          </Text>
        </Pressable>
      </View>

      {hasTime && (
        <View>
          <Text testID="task-time-display" style={styles.timePreview}>{formatWallClock(hour, minute, timeFormat)}</Text>
          <View style={styles.timeStepperRow}>
            <View style={styles.stepper}>
              <Pressable accessibilityRole="button" accessibilityLabel="Уменьшить час" accessibilityState={{ disabled: saving }} disabled={saving} onPress={() => adjustHour(-1)} style={styles.stepperButton}><Text style={styles.stepperButtonText}>−</Text></Pressable>
              <Text testID="task-hour-value" accessibilityLabel={`Час ${displayHour}`} style={styles.stepperValue}>{uses12Hour ? displayHour : String(displayHour).padStart(2, '0')}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Увеличить час" accessibilityState={{ disabled: saving }} disabled={saving} onPress={() => adjustHour(1)} style={styles.stepperButton}><Text style={styles.stepperButtonText}>+</Text></Pressable>
            </View>
            <Text style={styles.timeColon}>:</Text>
            <View style={styles.stepper}>
              <Pressable accessibilityRole="button" accessibilityLabel="Уменьшить минуты" accessibilityState={{ disabled: saving }} disabled={saving} onPress={() => adjustMinute(-5)} style={styles.stepperButton}><Text style={styles.stepperButtonText}>−</Text></Pressable>
              <Text testID="task-minute-value" accessibilityLabel={`Минуты ${minute}`} style={styles.stepperValue}>{String(minute).padStart(2, '0')}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Увеличить минуты" accessibilityState={{ disabled: saving }} disabled={saving} onPress={() => adjustMinute(5)} style={styles.stepperButton}><Text style={styles.stepperButtonText}>+</Text></Pressable>
            </View>
            {uses12Hour && <View accessibilityRole="radiogroup" style={styles.meridiemGroup}>{(['AM','PM'] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={`Выбрать ${value}`} accessibilityState={{ selected: meridiem === value, disabled: saving }} disabled={saving || meridiem === value} onPress={toggleMeridiem} style={[styles.meridiemButton, meridiem === value && styles.meridiemButtonActive]}><Text style={[styles.meridiemText, meridiem === value && styles.meridiemTextActive]}>{value}</Text></Pressable>)}</View>}
          </View>
        </View>
      )}

      {/* Длительность */}
      <Text style={styles.sectionLabel}>Длительность</Text>
      <View style={styles.chipsWrap}>
        {TASK_DURATION_PRESETS.map((mins) => (
          <Pressable
            key={mins ?? "unknown"}
            accessibilityRole="button"
            accessibilityState={{ selected: durationMinutes === mins }}
            style={[styles.chip, durationMinutes === mins && styles.chipActive]}
            onPress={() => setDurationMinutes(mins)}
          >
            <Text
              style={[
                styles.chipText,
                durationMinutes === mins && styles.chipTextActive,
              ]}
            >
              {taskDurationLabel(mins)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Цвет */}
      <Text style={styles.sectionLabel}>Цвет</Text>
      <View style={styles.chipsWrap}>
        {COLOR_PRESETS.map((c) => (
          <Pressable
            key={c}
            onPress={() => setColor(c)}
            style={[
              styles.colorSwatch,
              { backgroundColor: c },
              color === c && styles.colorSwatchActive,
            ]}
          />
        ))}
      </View>

      {/* Повтор */}
      <Text style={styles.sectionLabel}>Повтор</Text>
      <View style={styles.chipsWrap}>
        {(Object.keys(RECURRENCE_LABELS) as RecurrencePreset[]).map((preset) => (
          <Pressable
            key={preset}
            accessibilityRole="radio"
            accessibilityLabel={preset === "none" && existingTask?.seriesId ? "Остановить повтор с сегодняшнего дня" : RECURRENCE_LABELS[preset]}
            accessibilityState={{ selected: recurrencePreset === preset }}
            style={[styles.chip, recurrencePreset === preset && styles.chipActive]}
            onPress={() => {
              if (preset !== "none" && !hasTime) {
                Alert.alert("Укажите время", "Повтору нужно конкретное время начала.");
                return;
              }
              if (preset !== "none" && partsDraft.length) {
                Alert.alert("Сначала уберите части", "Части задачи недоступны для повторяющихся задач.");
                return;
              }
              setRecurrencePreset(preset);
            }}
          >
            <Text
              style={[styles.chipText, recurrencePreset === preset && styles.chipTextActive]}
            >
              {preset === "none" && existingTask?.seriesId ? "Остановить повтор с сегодняшнего дня" : RECURRENCE_LABELS[preset]}
            </Text>
          </Pressable>
        ))}
      </View>
      {isEditMode && (existingTask?.seriesId || existingTask?.isRecurring) && (
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
            <Text style={styles.partCheckText}>{part.completed ? "✓" : ""}</Text>
          </Pressable>
          <TextInput
            accessibilityLabel={`Название части: ${part.title}`}
            accessibilityHint={part.title.trim().length === 0
              ? "Название части не может быть пустым"
              : part.title.trim().length > MAX_TASK_PART_TITLE_LENGTH
                ? `Название части должно быть не длиннее ${MAX_TASK_PART_TITLE_LENGTH} символов`
                : undefined}
            editable={!saving}
            value={part.title}
            onChangeText={(value) => updatePart(part.draftId, value)}
            maxLength={MAX_TASK_PART_TITLE_LENGTH}
            style={[
              styles.subtaskInput,
              styles.partTitleInput,
              (part.title.trim().length === 0 || part.title.trim().length > MAX_TASK_PART_TITLE_LENGTH) && styles.invalidInput,
              part.completed && styles.partCompletedText,
            ]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Удалить часть: ${part.title}`}
            accessibilityState={{ disabled: saving }}
            disabled={saving}
            onPress={() => removePart(part.draftId)}
            style={styles.subtaskRemoveButton}
          >
            <Text style={styles.subtaskRemove}>×</Text>
          </Pressable>
        </View>
      ))}

      <View style={styles.subtaskInputRow}>
        <TextInput
          style={styles.subtaskInput}
          placeholder="Добавить часть"
          placeholderTextColor="#9CA3AF"
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
          onPress={addSubtaskFromInput}
          style={styles.subtaskAddButton}
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

      {/* Действия */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Сохранить задачу"
        accessibilityHint={partsValidationMessage ?? undefined}
        accessibilityState={{ busy: saving, disabled: saveDisabled }}
        style={[
          styles.saveButton,
          saveDisabled && styles.saveButtonDisabled,
        ]}
        onPress={handleSave}
        disabled={saveDisabled}
      >
        <Text style={styles.saveButtonText}>
          {saving ? "Сохранение…" : "Сохранить"}
        </Text>
      </Pressable>

      {isEditMode && (
        <Pressable style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>
            {existingTask?.seriesId || existingTask?.isRecurring ? "Удалить весь повтор" : "Удалить задачу"}
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  content: { padding: 20, paddingBottom: 48 },
  titleInput: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingVertical: 10,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 16,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  supportingText: { fontSize: 13, lineHeight: 18, color: "#6B7280", marginBottom: 8 },
  firstStepInput: {
    borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: "#111827",
  },
  row: { flexDirection: "row", gap: 8 },
  toggleChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },
  toggleChipActive: { backgroundColor: "#6B5BFC" },
  toggleChipText: { fontSize: 13, color: "#6B7280", fontWeight: "600" },
  toggleChipTextActive: { color: "#FFFFFF" },
  timePreview: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  meridiemGroup: { gap: 4, marginLeft: 8 },
  meridiemButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  meridiemButtonActive: { backgroundColor: "#6B5BFC" },
  meridiemText: { color: "#374151", fontWeight: "600" },
  meridiemTextActive: { color: "#FFFFFF" },
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
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperButtonText: { fontSize: 18, color: "#111827", fontWeight: "600" },
  stepperValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    width: 44,
    textAlign: "center",
  },
  timeColon: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginHorizontal: 4,
  },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },
  chipActive: { backgroundColor: "#6B5BFC" },
  chipText: { fontSize: 13, color: "#6B7280", fontWeight: "600" },
  chipTextActive: { color: "#FFFFFF" },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorSwatchActive: { borderColor: "#111827" },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#6B5BFC",
  },
  presetChipText: { fontSize: 13, color: "#6B5BFC", fontWeight: "600" },
  subtaskRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  subtaskText: { fontSize: 14, color: "#111827" },
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
    borderColor: "#6B7280",
    borderRadius: 5,
    textAlign: "center",
    lineHeight: 22,
    color: "#6B5BFC",
    fontWeight: "700",
  },
  partTitleInput: { paddingVertical: 8 },
  partCompletedText: { textDecorationLine: "line-through", color: "#6B7280" },
  subtaskRemoveButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  subtaskRemove: { fontSize: 18, color: "#9CA3AF", paddingHorizontal: 8 },
  subtaskInputRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    alignItems: "center",
  },
  subtaskInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
  },
  invalidInput: { borderColor: "#DC2626" },
  validationText: { color: "#B91C1C", fontSize: 13, lineHeight: 18, marginTop: 6 },
  subtaskAddButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  subtaskAddButtonText: { fontSize: 20, color: "#111827" },
  saveButton: {
    marginTop: 28,
    backgroundColor: "#6B5BFC",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  deleteButton: { marginTop: 16, paddingVertical: 12, alignItems: "center" },
  deleteButtonText: { color: "#EF4444", fontSize: 14, fontWeight: "600" },
});
