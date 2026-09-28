import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Task, TimeFormat } from '@focus/shared-types';
import { TIMELINE_CONFIG } from '../../lib/timeline-config';
import { getTimelineMinutesFromStart, getTimelineWallClock } from '../../lib/timeline-geometry';
import { taskKind } from '../../lib/task-kind';
import { useOrbitsTheme } from '../../theme/orbits';
import { formatWallClock, keepMeridiemTogether } from '../../lib/time-format';
import { normalizeTaskColor, taskInkWash, taskTextColor } from '../today/task-color';
import {
  getTaskElapsedState,
  taskElapsedAccessibilityLabel,
  taskElapsedVisualLabel,
} from '../../lib/task-elapsed';
import { TaskElapsedFill } from './TaskElapsedFill';

interface Props {
  task: Task;
  onToggle: (id: string) => void;
  onOpen: (task: Task) => void;
  onShowActions?: (task: Task) => void;
  timeFormat?: TimeFormat;
  columnIndex?: number;
  columnCount?: number;
  isCurrent?: boolean;
  profileTimezone?: string | null;
  topOffset?: number;
  layoutTop?: number;
  layoutHeight?: number;
  gutterWidth?: number;
  showTimeLabel?: boolean;
  nowMs?: number;
  animateElapsed?: boolean;
  onMeasuredHeight?: (taskId: string, height: number) => void;
}

/**
 * A task owns its chosen color as an accent. The timeline keeps a neutral
 * surface, with the color rail at the left and completion at the right.
 * The card remains the ordinary open target; long press opens secondary moves.
 */
export function TaskBlock({
  task,
  onToggle,
  onOpen,
  onShowActions,
  timeFormat = 'SYSTEM',
  columnIndex = 0,
  columnCount = 1,
  isCurrent = false,
  profileTimezone,
  topOffset = 0,
  layoutTop,
  layoutHeight,
  gutterWidth = 58,
  showTimeLabel = true,
  nowMs = Date.now(),
  animateElapsed = false,
  onMeasuredHeight,
}: Props) {
  const theme = useOrbitsTheme();
  const now = new Date(nowMs);
  const completion = useRef(new Animated.Value(task.completedAt ? 1 : 0)).current;
  const previousCompletion = useRef(Boolean(task.completedAt));
  const previousStart = useRef({ taskId: task.id, started: Boolean(task.startedAt) });
  const animateElapsedOnMount = previousStart.current.taskId === task.id &&
    !previousStart.current.started && Boolean(task.startedAt);

  useEffect(() => {
    const nextCompletion = Boolean(task.completedAt);
    if (previousCompletion.current === nextCompletion) return;
    previousCompletion.current = nextCompletion;
    const animation = Animated.timing(completion, {
      toValue: task.completedAt ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [completion, task.completedAt]);

  useEffect(() => {
    previousStart.current = { taskId: task.id, started: Boolean(task.startedAt) };
  }, [task.id, task.startedAt]);

  if (!task.startTime || taskKind(task) !== 'TASK') return null;

  const startMinutes = getTimelineMinutesFromStart(new Date(task.startTime), profileTimezone);
  const top = layoutTop ?? Math.max(0, (startMinutes / 60) * TIMELINE_CONFIG.hourHeight) + topOffset;
  const height = layoutHeight ?? Math.max(
    TIMELINE_CONFIG.minBlockHeight,
    task.durationMinutes === null
      ? TIMELINE_CONFIG.minBlockHeight
      : (task.durationMinutes / 60) * TIMELINE_CONFIG.hourHeight,
  );
  const startClock = TIMELINE_CONFIG.dayStartHour * 60 + startMinutes;
  const timeLabel = keepMeridiemTogether(formatWallClock(
    Math.floor(startClock / 60) % 24,
    ((startClock % 60) + 60) % 60,
    timeFormat,
  ));

  const isDone = Boolean(task.completedAt);
  const elapsed = getTaskElapsedState(task, now);
  const isExplicitlyStarted = Boolean(task.startedAt && !task.completedAt);
  const currentWallClock = getTimelineWallClock(now, profileTimezone);
  const currentTimeLabel = keepMeridiemTogether(formatWallClock(
    currentWallClock.hours,
    currentWallClock.minutes,
    timeFormat,
  ));
  const durationLabel = task.durationMinutes === null ? 'Без длительности' : `${task.durationMinutes} мин`;
  const scheduledMeta = `${timeLabel}  ·  ${durationLabel}`;
  const liveMeta = elapsed
    ? `Сейчас ${currentTimeLabel} · ${taskElapsedVisualLabel(elapsed).replace(/^./, (letter) => letter.toLocaleLowerCase('ru-RU'))}`
    : isExplicitlyStarted ? `Сейчас ${currentTimeLabel} · задача начата` : null;
  const accent = normalizeTaskColor(task.color, theme.brand);
  const buttonInk = taskTextColor(accent, theme.brand);
  const accentSoft = taskInkWash(accent, '18');
  const accentBorder = taskInkWash(accent, '70');
  const subTasks = task.subTasks ?? [];
  const completedParts = subTasks.filter((subtask) => subtask.completedAt).length;
  const isCompact = height <= 40 && !isExplicitlyStarted;
  const showMeta = !isCompact;
  const columnWidthPercent = 100 / columnCount;

  return (
    <View testID={`task-block-row-${task.id}`} style={[styles.row, { top, height }]} pointerEvents="box-none">
      {columnIndex === 0 && showTimeLabel ? (
        <View style={[styles.timePill, { backgroundColor: theme.surfaceMuted, width: gutterWidth - 8 }]} pointerEvents="none">
          <Text numberOfLines={1} style={[styles.timeText, { color: theme.textSecondary }]}>{timeLabel}</Text>
        </View>
      ) : null}

      <View style={[styles.cardArea, { left: gutterWidth }]} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.animatedCard,
            {
              left: `${columnIndex * columnWidthPercent}%`,
              width: `${columnWidthPercent}%`,
              opacity: completion.interpolate({ inputRange: [0, 1], outputRange: [1, 0.58] }),
              transform: [{ scale: completion.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] }) }],
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${task.title}. Запланировано на ${timeLabel}, ${durationLabel}${isDone ? '. Выполнено' : ''}${isCurrent && !isExplicitlyStarted ? '. Сейчас по плану' : ''}${isExplicitlyStarted ? `. Сейчас ${currentTimeLabel}` : ''}${elapsed ? `. ${taskElapsedAccessibilityLabel(elapsed)}` : isExplicitlyStarted ? '. Задача начата' : ''}`}
            accessibilityHint="Нажмите, чтобы открыть задачу. Удерживайте для переноса или отправки в Мысли"
            delayLongPress={520}
            onPress={() => onOpen(task)}
            onLongPress={() => onShowActions?.(task)}
            style={({ pressed }) => [
              styles.block,
              isCompact && styles.compactBlock,
              {
                backgroundColor: theme.surfacePrimary,
                borderColor: isCurrent ? accent : accentBorder,
                shadowColor: theme.elevationShadow,
                transform: [{ scale: pressed ? 0.985 : 1 }],
              },
            ]}
          >
            {elapsed ? (
              <TaskElapsedFill
                taskId={task.id}
                progress={elapsed.progress}
                startedAt={task.startedAt}
                color={accentSoft}
                animationEnabled={animateElapsed}
                animateOnMount={animateElapsedOnMount}
              />
            ) : null}
            <View
              testID={`task-duration-rail-${task.id}`}
              style={[styles.durationRail, { backgroundColor: accent }]}
              pointerEvents="none"
            />

            <View
              testID={`task-copy-${task.id}`}
              style={styles.copy}
              onLayout={(event) => {
                if (!onMeasuredHeight) return;
                const contentHeight = Math.ceil(event.nativeEvent.layout.height + (isCompact ? 6 : 14));
                onMeasuredHeight(task.id, Math.max(contentHeight, isCompact ? 32 : 48));
              }}
            >
              <View style={styles.primaryLine}>
                {isCurrent && !isExplicitlyStarted ? (
                  <Text
                    testID={`task-current-cue-${task.id}`}
                    style={[styles.currentState, { color: accent, backgroundColor: accentSoft }]}
                  >
                    Сейчас
                  </Text>
                ) : null}
                <Text
                  style={[styles.title, isDone && styles.titleDone, { color: theme.textPrimary }]}
                  numberOfLines={isCompact ? 1 : isExplicitlyStarted ? 3 : 2}
                >
                  {task.title}
                </Text>
              </View>
              {showMeta ? (
                <View style={styles.metaGroup}>
                  <Text
                    testID={`task-scheduled-meta-${task.id}`}
                    style={[styles.meta, { color: theme.textSecondary }]}
                    numberOfLines={1}
                  >
                    {scheduledMeta}
                  </Text>
                  {liveMeta ? (
                    <Text
                      testID={`task-elapsed-label-${task.id}`}
                      style={[styles.liveMeta, { color: elapsed?.overdue ? theme.errorPrimary : theme.textSecondary }]}
                    >
                      {liveMeta}
                    </Text>
                  ) : null}
                  {subTasks.length > 0 ? (
                    <Text style={[styles.meta, { color: theme.textSecondary }]}>
                      {completedParts}/{subTasks.length} шагов
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>

            <Pressable
              testID={`task-completion-${task.id}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isDone }}
              accessibilityLabel={`${isDone ? 'Вернуть' : 'Завершить'} задачу ${task.title}`}
              hitSlop={8}
              onPress={(event) => {
                event?.stopPropagation?.();
                onToggle(task.id);
              }}
              style={[
                styles.check,
                isCompact && styles.compactCheck,
                { borderColor: accent, backgroundColor: isDone ? accent : 'transparent' },
              ]}
            >
              <Animated.Text
                testID={`task-completed-cue-${task.id}`}
                style={[
                  styles.checkMark,
                  {
                    color: buttonInk,
                    opacity: completion,
                    transform: [{ scale: completion.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }) }],
                  },
                ]}
              >
                ✓
              </Animated.Text>
            </Pressable>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: 0,
    right: 8,
  },
  timePill: {
    position: 'absolute',
    left: 4,
    top: 4,
    width: 50,
    minHeight: 24,
    paddingHorizontal: 5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  cardArea: {
    position: 'absolute',
    left: 58,
    right: 0,
    top: 0,
    bottom: 0,
  },
  animatedCard: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    paddingHorizontal: 2,
  },
  block: {
    flex: 1,
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 9,
    elevation: 2,
  },
  compactBlock: {
    gap: 6,
    borderRadius: 13,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  checkMark: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '800',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    zIndex: 1,
  },
  primaryLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 20,
  },
  title: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  titleDone: {
    textDecorationLine: 'line-through',
  },
  currentState: {
    fontSize: 9,
    lineHeight: 15,
    fontWeight: '800',
    borderRadius: 8,
    paddingHorizontal: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  meta: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
    opacity: 0.74,
  },
  metaGroup: {
    marginTop: 2,
    gap: 1,
  },
  liveMeta: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  durationRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    zIndex: 2,
  },
});
