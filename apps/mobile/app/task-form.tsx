import { useMemo, useState } from "react";
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
import { useQueryClient } from "@tanstack/react-query";
import type { Task } from "@focus/shared-types";
import {
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  createSubtask,
  deleteTaskById,
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

const SUBTASK_PRESETS: Record<string, string[]> = {
  "Уборка комнаты": ["Мусор", "Пол", "Поверхности"],
  "Утренняя рутина": ["Вода", "Зарядка", "Завтрак"],
};

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function recurrencePresetFromRule(rule: string | null): RecurrencePreset {
  if (rule === RECURRENCE_RULES.weekdays) return "weekdays";
  if (rule === RECURRENCE_RULES.daily) return "daily";
  return "none";
}

export default function TaskFormScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
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

  const isEditMode = !!existingTask;

  const createTask = useCreateTask(today, profileTimezone);
  const updateTask = useUpdateTask(today, profileTimezone);
  const deleteTask = useDeleteTask(today, profileTimezone);

  const [title, setTitle] = useState(
    existingTask?.title ?? params.prefillTitle ?? "",
  );
  const [firstStep, setFirstStep] = useState(existingTask?.firstStep ?? "");

  const initialStartTime =
    existingTask?.startTime ??
    (params.prefillStartTime ? new Date(params.prefillStartTime) : null);

  const initialWallClock = initialStartTime && profileTimezone &&
    isValidIANATimezone(profileTimezone) && params.selectedDateKey
    ? getLocalHoursMinutes(initialStartTime, profileTimezone)
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
    recurrencePresetFromRule(existingTask?.recurrenceRule ?? null),
  );

  const [existingSubtasks, setExistingSubtasks] = useState(
    existingTask?.subTasks ?? [],
  );
  const [newSubtasks, setNewSubtasks] = useState<string[]>([]);
  const [subtaskInput, setSubtaskInput] = useState("");

  const [saving, setSaving] = useState(false);

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
    setNewSubtasks((prev) => [...prev, value]);
    setSubtaskInput("");
  }

  function addSubtaskPreset(presetName: string) {
    setNewSubtasks((prev) => [...prev, ...SUBTASK_PRESETS[presetName]]);
  }

  function removeNewSubtask(index: number) {
    setNewSubtasks((prev) => prev.filter((_, i) => i !== index));
  }

  async function removeExistingSubtask(subtaskId: string) {
    setExistingSubtasks((prev) => prev.filter((s) => s.id !== subtaskId));
    try {
      await deleteTaskById(subtaskId);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    } catch {
      Alert.alert("Не удалось удалить шаг", "Попробуйте снова");
    }
  }

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);

    const startTimeIso = hasTime
      ? initialStartTime && !wallClockEdited
        ? initialStartTime.toISOString()
        : calendarDayWallTimeToInstant(
            selectedDateKey, hour, minute, profileTimezone,
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
    };

    try {
      let parentId: string;
      if (isEditMode && existingTask) {
        const updated = await updateTask.mutateAsync({
          id: existingTask.id,
          dto,
        });
        parentId = updated.id;
      } else {
        const created = await createTask.mutateAsync(dto);
        parentId = created.id;
      }

      for (const subtaskTitle of newSubtasks) {
        await createSubtask(parentId, subtaskTitle);
      }
      if (newSubtasks.length > 0) {
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
      }

      router.back();
    } catch (err) {
      if (isFreeTierLimitError(err)) {
        router.replace("/paywall");
      } else {
        Alert.alert(
          "Не удалось сохранить",
          "Проверьте соединение и попробуйте снова",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!existingTask) return;
    Alert.alert("Удалить задачу?", existingTask.title, [
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
          style={[styles.toggleChip, !hasTime && styles.toggleChipActive]}
          onPress={() => setHasTime(false)}
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
            style={[styles.chip, recurrencePreset === preset && styles.chipActive]}
            onPress={() => setRecurrencePreset(preset)}
          >
            <Text
              style={[styles.chipText, recurrencePreset === preset && styles.chipTextActive]}
            >
              {RECURRENCE_LABELS[preset]}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Подзадачи */}
      <Text style={styles.sectionLabel}>Разбить на шаги</Text>
      <View style={styles.chipsWrap}>
        {Object.keys(SUBTASK_PRESETS).map((presetName) => (
          <Pressable
            key={presetName}
            style={styles.presetChip}
            onPress={() => addSubtaskPreset(presetName)}
          >
            <Text style={styles.presetChipText}>+ {presetName}</Text>
          </Pressable>
        ))}
      </View>

      {existingSubtasks.map((s) => (
        <View key={s.id} style={styles.subtaskRow}>
          <Text style={styles.subtaskText}>{s.title}</Text>
          <Pressable onPress={() => removeExistingSubtask(s.id)}>
            <Text style={styles.subtaskRemove}>×</Text>
          </Pressable>
        </View>
      ))}
      {newSubtasks.map((s, i) => (
        <View key={`new-${i}`} style={styles.subtaskRow}>
          <Text style={styles.subtaskText}>{s}</Text>
          <Pressable onPress={() => removeNewSubtask(i)}>
            <Text style={styles.subtaskRemove}>×</Text>
          </Pressable>
        </View>
      ))}

      <View style={styles.subtaskInputRow}>
        <TextInput
          style={styles.subtaskInput}
          placeholder="Добавить шаг"
          placeholderTextColor="#9CA3AF"
          value={subtaskInput}
          onChangeText={setSubtaskInput}
          onSubmitEditing={addSubtaskFromInput}
          returnKeyType="done"
        />
        <Pressable
          onPress={addSubtaskFromInput}
          style={styles.subtaskAddButton}
        >
          <Text style={styles.subtaskAddButtonText}>+</Text>
        </Pressable>
      </View>

      {/* Действия */}
      <Pressable
        style={[
          styles.saveButton,
          (!title.trim() || saving) && styles.saveButtonDisabled,
        ]}
        onPress={handleSave}
        disabled={!title.trim() || saving}
      >
        <Text style={styles.saveButtonText}>
          {saving ? "Сохранение…" : "Сохранить"}
        </Text>
      </Pressable>

      {isEditMode && (
        <Pressable style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>Удалить задачу</Text>
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
  subtaskAddButton: {
    width: 40,
    height: 40,
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
