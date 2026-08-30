import { View, Pressable, Text, StyleSheet } from 'react-native';
import type { Task } from '@focus/shared-types';
import { TIMELINE_CONFIG } from '../../lib/timeline-config';
import { getTimelineMinutesFromStart } from '../../lib/timeline-geometry';
import { taskKind } from '../../lib/task-kind';
import { useOrbitsTheme } from '../../theme/orbits';
import { normalizeTaskColor, softTaskColor } from '../today/task-color';

interface Props {
  task: Task;
  onToggle: (id: string) => void;
  onOpen: (task: Task) => void;
  columnIndex?: number;
  columnCount?: number;
  isCurrent?: boolean;
  profileTimezone?: string | null;
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
export function TaskBlock({ task, onToggle, onOpen, columnIndex = 0, columnCount = 1, isCurrent = false, profileTimezone }: Props) {
  const theme = useOrbitsTheme();
  if (!task.startTime || taskKind(task) !== 'TASK') return null;

  const startMinutes = getTimelineMinutesFromStart(new Date(task.startTime), profileTimezone);
  const top = Math.max(0, (startMinutes / 60) * TIMELINE_CONFIG.hourHeight);
  const height = Math.max(
    TIMELINE_CONFIG.minBlockHeight,
    task.durationMinutes === null
      ? TIMELINE_CONFIG.minBlockHeight
      : (task.durationMinutes / 60) * TIMELINE_CONFIG.hourHeight,
  );

  const isDone = Boolean(task.completedAt);
  const accent = normalizeTaskColor(task.color, theme.brand);
  const subTasks = task.subTasks ?? [];
  const isCompact = height <= 40;
  const showSubtasks = subTasks.length > 0 && !isCompact;
  const columnWidthPercent = 100 / columnCount;

  return (
    <View testID={`task-block-row-${task.id}`} style={[styles.row, { top, height }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isDone }}
        accessibilityLabel={`${task.title}${isDone ? ', Выполнено' : ''}${isCurrent ? ', Сейчас' : ''}`}
        accessibilityHint="Нажмите, чтобы изменить выполнение. Удерживайте, чтобы открыть задачу"
        onPress={() => onToggle(task.id)}
        onLongPress={() => onOpen(task)}
        style={[
          styles.block,
          isCompact && styles.compactBlock,
          {
            left: `${columnIndex * columnWidthPercent}%`,
            width: `${columnWidthPercent}%`,
            backgroundColor: isDone
              ? theme.completionSoft
              : softTaskColor(task.color, theme.brand),
            borderLeftColor: isDone ? theme.completionPrimary : accent,
            borderLeftWidth: isCurrent ? 6 : 4,
            borderWidth: isCurrent ? 2 : 0,
            borderColor: isCurrent ? theme.brand : 'transparent',
          },
        ]}
      >
        <View style={styles.primaryLine}>
          {isDone ? (
            <Text
              testID={`task-completed-cue-${task.id}`}
              style={[styles.state, { color: theme.completionPrimary }]}
            >
              ✓
            </Text>
          ) : null}
          {isCurrent ? (
            <Text
              testID={`task-current-cue-${task.id}`}
              style={[
                styles.currentState,
                {
                  color: theme.activeSurfaceText,
                  backgroundColor: theme.activeSurface,
                },
              ]}
            >
              Сейчас
            </Text>
          ) : null}
          <Text
            style={[
              styles.title,
              isDone && styles.titleDone,
              { color: isDone ? theme.completionPrimary : theme.textPrimary },
            ]}
            numberOfLines={isCompact ? 1 : 2}
          >
            {task.title}
          </Text>
        </View>
        {showSubtasks ? (
          <Text style={[styles.subCount, { color: theme.textSecondary }]}>
            {subTasks.filter((subtask) => subtask.completedAt).length}/{subTasks.length}
          </Text>
        ) : null}
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
    paddingVertical: 4,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  compactBlock: { paddingVertical: 2 },
  primaryLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 20,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  titleDone: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  state: { fontSize: 12, fontWeight: '700' },
  currentState: {
    fontSize: 10,
    lineHeight: 16,
    fontWeight: '700',
    borderRadius: 8,
    paddingHorizontal: 5,
  },
  subCount: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
});
