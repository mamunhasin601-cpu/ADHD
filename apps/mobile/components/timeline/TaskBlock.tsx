import { View, Pressable, Text, StyleSheet } from 'react-native';
import type { Task } from '@focus/shared-types';
import { TIMELINE_CONFIG } from '../../lib/timeline-config';

interface Props {
  task: Task;
  onToggle: (id: string) => void;
  onOpen: (task: Task) => void;
  columnIndex?: number;
  columnCount?: number;
  isCurrent?: boolean;
}

function minutesFromDayStart(date: Date): number {
  return (date.getHours() - TIMELINE_CONFIG.dayStartHour) * 60 + date.getMinutes();
}

/**
 * Тап = быстрый тоггл "готово" (мгновенно, без захода в задачу — низкий фрикшн).
 * Долгий тап = открыть детали. Пока это заглушка-алерт — полноценный экран
 * редактирования будет в следующем шаге роадмапа.
 *
 * Пересекающиеся по времени задачи (columnCount > 1) делят горизонтальную полосу
 * на равные колонки через проценты — так раскладку считает сам RN layout,
 * без ручных измерений ширины экрана.
 */
export function TaskBlock({ task, onToggle, onOpen, columnIndex = 0, columnCount = 1, isCurrent = false }: Props) {
  if (!task.startTime) return null;

  const startMinutes = minutesFromDayStart(new Date(task.startTime));
  const top = Math.max(0, (startMinutes / 60) * TIMELINE_CONFIG.hourHeight);
  const height = Math.max(
    TIMELINE_CONFIG.minBlockHeight,
    (task.durationMinutes / 60) * TIMELINE_CONFIG.hourHeight,
  );

  const isDone = !!task.completedAt;
  const subTasks = task.subTasks ?? [];

  const columnWidthPercent = 100 / columnCount;

  return (
    <View style={[styles.row, { top, height }]}>
      <Pressable
        onPress={() => onToggle(task.id)}
        onLongPress={() => onOpen(task)}
        style={[
          styles.block,
          {
            left: `${columnIndex * columnWidthPercent}%`,
            width: `${columnWidthPercent}%`,
            backgroundColor: isDone ? '#E5E7EB' : `${task.color}22`,
            borderLeftColor: task.color,
            borderLeftWidth: isCurrent ? 6 : 4,
            borderWidth: isCurrent ? 2 : 0,
            borderColor: isCurrent ? task.color : 'transparent',
          },
        ]}
      >
        <Text style={[styles.title, isDone && styles.titleDone]} numberOfLines={2}>
          {task.title}
        </Text>
        {subTasks.length > 0 && (
          <Text style={styles.subCount}>
            {subTasks.filter((s) => s.completedAt).length}/{subTasks.length}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: 56,
    right: 8,
  },
  block: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    marginHorizontal: 2,
    borderRadius: 8,
    borderLeftWidth: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  titleDone: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  subCount: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
});
