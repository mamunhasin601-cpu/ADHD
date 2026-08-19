import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Task, TimeFormat } from '@focus/shared-types';
import { formatWallClock } from '../../lib/time-format';
import { TIMELINE_CONFIG } from '../../lib/timeline-config';
import { getTimelineMinutesFromStart } from '../../lib/timeline-geometry';
import { taskKind } from '../../lib/task-kind';

interface Props {
  task: Task;
  onOpen: (task: Task) => void;
  timeFormat: TimeFormat;
  columnIndex?: number;
  columnCount?: number;
  profileTimezone?: string | null;
}

function minuteWord(minutes: number): string {
  const lastTwo = minutes % 100;
  const last = minutes % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return 'минут';
  if (last === 1) return 'минута';
  if (last >= 2 && last <= 4) return 'минуты';
  return 'минут';
}

export function PlanBlock({
  task,
  onOpen,
  timeFormat,
  columnIndex = 0,
  columnCount = 1,
  profileTimezone,
}: Props) {
  if (!task.startTime) return null;
  const kind = taskKind(task);
  if (kind === 'TASK') return null;

  const startMinutes = getTimelineMinutesFromStart(new Date(task.startTime), profileTimezone);
  const duration = task.durationMinutes;
  const top = Math.max(0, (startMinutes / 60) * TIMELINE_CONFIG.hourHeight);
  const height = Math.max(
    TIMELINE_CONFIG.minBlockHeight,
    duration === null ? TIMELINE_CONFIG.minBlockHeight : (duration / 60) * TIMELINE_CONFIG.hourHeight,
  );
  const startClock = TIMELINE_CONFIG.dayStartHour * 60 + startMinutes;
  const endClock = duration === null ? null : startClock + duration;
  const typeLabel = kind === 'REST' ? 'Отдых' : 'Буфер';
  const accessibilityLabel = endClock === null
    ? `${typeLabel}: ${task.title}, начало ${formatWallClock(Math.floor(startClock / 60) % 24, startClock % 60, timeFormat)}, время окончания и длительность не указаны`
    : `${typeLabel}: ${task.title}, с ${formatWallClock(Math.floor(startClock / 60) % 24, startClock % 60, timeFormat)} до ${formatWallClock(Math.floor(endClock / 60) % 24, endClock % 60, timeFormat)}, ${duration!} ${minuteWord(duration!)}`;
  const columnWidthPercent = 100 / columnCount;

  return (
    <View testID={`plan-block-row-${task.id}`} style={[styles.row, { top, height }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={() => onOpen(task)}
        style={[
          styles.block,
          kind === 'REST' ? styles.rest : styles.buffer,
          {
            left: `${columnIndex * columnWidthPercent}%`,
            width: `${columnWidthPercent}%`,
          },
        ]}
      >
        <Text style={styles.kind}>{typeLabel}</Text>
        <Text style={styles.title} numberOfLines={2}>{task.title}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { position: 'absolute', left: 56, right: 8 },
  block: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    marginHorizontal: 2,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    justifyContent: 'center',
  },
  rest: { backgroundColor: '#E8F3F4', borderColor: '#8FB8BC' },
  buffer: { backgroundColor: '#F4F0E7', borderColor: '#B8AA8D' },
  kind: { fontSize: 11, fontWeight: '700', color: '#4B5563' },
  title: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
});
