import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions, GestureResponderEvent } from 'react-native';
import { TIMELINE_CONFIG } from '../../lib/timeline-config';
import { NowIndicator } from './NowIndicator';
import { TaskBlock } from './TaskBlock';
import type { Task } from '@focus/shared-types';

interface Props {
  tasks: Task[];
  onToggle: (id: string) => void;
  onOpenTask: (task: Task) => void;
  onCreateAt: (startTime: Date) => void;
}

const { dayStartHour, dayEndHour, hourHeight } = TIMELINE_CONFIG;
const hours = Array.from({ length: dayEndHour - dayStartHour }, (_, i) => dayStartHour + i);
const totalHeight = hours.length * hourHeight;

export function Timeline({ tasks, onToggle, onOpenTask, onCreateAt }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [hasScrolledToNow, setHasScrolledToNow] = useState(false);

  // Открытие экрана — сразу центрируем на "сейчас", а не показываем список/меню сверху
  useEffect(() => {
    if (hasScrolledToNow) return;
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

    const start = new Date();
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
            <Text style={styles.hourLabel}>{String(hour % 24).padStart(2, '0')}:00</Text>
            <View style={styles.hourLine} />
          </View>
        ))}

        <NowIndicator />

        {tasks.map((task) => (
          <TaskBlock key={task.id} task={task} onToggle={onToggle} onOpen={onOpenTask} />
        ))}
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
