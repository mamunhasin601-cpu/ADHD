import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions, GestureResponderEvent } from 'react-native';
import { TIMELINE_CONFIG } from '../../lib/timeline-config';
import { computeTimelineLayout } from '../../lib/timeline-layout';
import { NowIndicator } from './NowIndicator';
import { TaskBlock } from './TaskBlock';
import type { Task } from '@focus/shared-types';
import { useAuthStore } from '../../stores/auth.store';
import { formatWallClock } from '../../lib/time-format';

interface Props {
  tasks: Task[];
  onToggle: (id: string) => void;
  onOpenTask: (task: Task) => void;
  onCreateAt: (startTime: Date) => void;
  shouldAutoScroll?: boolean;
  currentDate?: Date;
  currentTaskId?: string;
}

const { dayStartHour, dayEndHour, hourHeight } = TIMELINE_CONFIG;
const hours = Array.from({ length: dayEndHour - dayStartHour }, (_, i) => dayStartHour + i);
const totalHeight = hours.length * hourHeight;

export function Timeline({ tasks, onToggle, onOpenTask, onCreateAt, shouldAutoScroll = true, currentDate = new Date(), currentTaskId }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const timeFormat = useAuthStore((state) => state.user?.timeFormat ?? 'SYSTEM');
  const [hasScrolledToNow, setHasScrolledToNow] = useState(false);
  const layout = useMemo(() => computeTimelineLayout(tasks), [tasks]);

  // Открытие экрана — сразу центрируем на "сейчас", а не показываем список/меню сверху
  // Но только если смотрим на сегодня (shouldAutoScroll)
  useEffect(() => {
    if (!shouldAutoScroll || hasScrolledToNow) return;
    const now = new Date();
    const minutes = (now.getHours() - dayStartHour) * 60 + now.getMinutes();
    const totalMinutes = (dayEndHour - dayStartHour) * 60;
    if (minutes < 0 || minutes > totalMinutes) return; // сейчас ночь вне диапазона — остаёмся сверху

    const y = (minutes / 60) * hourHeight;
    const viewportHeight = Dimensions.get('window').height;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - viewportHeight / 2.5), animated: false });
      setHasScrolledToNow(true);
    });
  }, [hasScrolledToNow]);

  function handleBackgroundPress(event: GestureResponderEvent) {
    const y = event.nativeEvent.locationY;
    const minutesFromStart = (y / hourHeight) * 60;

    const start = new Date(currentDate);
    start.setHours(dayStartHour, 0, 0, 0);
    start.setMinutes(start.getMinutes() + Math.round(minutesFromStart / 15) * 15); // округляем до 15 мин
    onCreateAt(start);
  }

  return (
    <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
      <View
        style={{ height: totalHeight }}
        onStartShouldSetResponder={() => true}
        onResponderRelease={handleBackgroundPress}
      >
        {hours.map((hour) => (
          <View
            key={hour}
            style={[styles.hourRow, { top: (hour - dayStartHour) * hourHeight, height: hourHeight }]}
          >
            <Text style={styles.hourLabel}>{formatWallClock(hour % 24, 0, timeFormat)}</Text>
            <View style={styles.hourLine} />
          </View>
        ))}

        <NowIndicator />

        {tasks.map((task) => {
          const taskLayout = layout.get(task.id);
          return (
            <TaskBlock
              key={task.id}
              task={task}
              onToggle={onToggle}
              onOpen={onOpenTask}
              columnIndex={taskLayout?.columnIndex}
              columnCount={taskLayout?.columnCount}
              isCurrent={task.id === currentTaskId}
            />
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hourRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  hourLabel: {
    width: 48,
    fontSize: 12,
    color: '#9CA3AF',
    paddingLeft: 4,
  },
  hourLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
    marginTop: 6,
  },
});
