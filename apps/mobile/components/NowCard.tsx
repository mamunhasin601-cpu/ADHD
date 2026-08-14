import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Task } from "@focus/shared-types";
import { useAuthStore } from "../stores/auth.store";
import { formatClockTime } from "../lib/time-format";

type NowCardMode = "current" | "upcoming";

interface Props {
  task: Task;
  mode: NowCardMode;
  onComplete: (taskId: string) => void;
  onStart: (taskId: string) => void;
  onOpenTask: (task: Task) => void;
  isCompleting?: boolean;
  isStarting?: boolean;
  startError?: string | null;
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
  isCompleting = false,
  isStarting = false,
  startError = null,
}: Props) {
  const timeFormat = useAuthStore(
    (state) => state.user?.timeFormat ?? "SYSTEM",
  );
  const time = task.startTime
    ? formatClockTime(new Date(task.startTime), timeFormat)
    : null;
  const isCurrent = mode === "current";
  const isStarted = task.startedAt !== null;
  const actionsDisabled = isStarting || isCompleting;

  return (
    <View style={styles.card} accessibilityRole="summary">
      <Text style={styles.eyebrow}>Сейчас</Text>
      <Text style={styles.context}>
        {isStarted ? "Начато" : isCurrent ? "Запланировано сейчас" : "Ближайшее действие"}
      </Text>
      <Text style={styles.title} numberOfLines={2}>
        {task.title}
      </Text>

      <Text style={styles.meta}>
        {time
          ? `Запланировано на ${time}  •  `
          : ""}
        {task.durationMinutes === null
          ? "Длительность: Не знаю"
          : `около ${task.durationMinutes} мин`}
      </Text>
      {startError ? <Text accessibilityRole="alert" style={styles.error}>{startError}</Text> : null}

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
          <Pressable
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
});
