import { useRef } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { addCalendarDays } from '../lib/timezone';
import { useOrbitsTheme } from '../theme/orbits';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

export type WeekDayEntry = {
  date: string;
  weekday: (typeof WEEKDAYS)[number];
  dayNumber: number;
  selected: boolean;
  today: boolean;
  disabled: boolean;
  accessibilityLabel: string;
};

export type WeekSwipeDirection = 'previous' | 'next' | null;

const SWIPE_DISTANCE = 48;
const SWIPE_VELOCITY = 0.45;

export function resolveWeekSwipe(
  dx: number,
  vx: number,
  canGoPrevious: boolean,
): WeekSwipeDirection {
  if (dx <= -SWIPE_DISTANCE || vx <= -SWIPE_VELOCITY) return 'next';
  if (canGoPrevious && (dx >= SWIPE_DISTANCE || vx >= SWIPE_VELOCITY)) return 'previous';
  return null;
}

function utcDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

/** Builds the Monday–Sunday week containing the canonical selected day. */
export function buildWeekDays(selectedDate: string, todayDate: string): WeekDayEntry[] {
  const selected = utcDate(selectedDate);
  const mondayOffset = (selected.getUTCDay() + 6) % 7;
  const monday = addCalendarDays(selectedDate, -mondayOffset);

  return WEEKDAYS.map((weekday, index) => {
    const date = addCalendarDays(monday, index);
    const value = utcDate(date);
    const today = date === todayDate;
    const fullDate = new Intl.DateTimeFormat('ru-RU', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    }).format(value);
    return {
      date,
      weekday,
      dayNumber: value.getUTCDate(),
      selected: date === selectedDate,
      today,
      disabled: date < todayDate,
      accessibilityLabel: today ? `${fullDate}, сегодня` : fullDate,
    };
  });
}

type WeekStripProps = {
  selectedDate: string;
  todayDate: string;
  canGoPrevious: boolean;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onSelectDate: (date: string) => void;
};

export function WeekStrip({
  selectedDate,
  todayDate,
  canGoPrevious,
  onPreviousWeek,
  onNextWeek,
  onSelectDate,
}: WeekStripProps) {
  const theme = useOrbitsTheme();
  const days = buildWeekDays(selectedDate, todayDate);
  const translateX = useRef(new Animated.Value(0)).current;
  const width = useRef(0);
  const gestureCallbacks = useRef({ canGoPrevious, onPreviousWeek, onNextWeek });
  gestureCallbacks.current = { canGoPrevious, onPreviousWeek, onNextWeek };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderGrant: () => translateX.stopAnimation(),
      onPanResponderMove: (_, gesture) => {
        const resistance = !gestureCallbacks.current.canGoPrevious && gesture.dx > 0 ? 0.25 : 1;
        translateX.setValue(gesture.dx * resistance);
      },
      onPanResponderRelease: (_, gesture) => {
        const direction = resolveWeekSwipe(
          gesture.dx,
          gesture.vx,
          gestureCallbacks.current.canGoPrevious,
        );

        if (!direction) {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
          return;
        }

        const pageWidth = Math.max(width.current, 280);
        Animated.timing(translateX, {
          toValue: direction === 'next' ? -pageWidth : pageWidth,
          duration: 140,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (!finished) return;
          if (direction === 'next') gestureCallbacks.current.onNextWeek();
          else gestureCallbacks.current.onPreviousWeek();
          translateX.setValue(direction === 'next' ? pageWidth : -pageWidth);
          requestAnimationFrame(() => {
            Animated.timing(translateX, {
              toValue: 0,
              duration: 160,
              useNativeDriver: true,
            }).start();
          });
        });
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  return (
    <View style={styles.viewport} testID="week-strip">
      <Animated.View
        accessibilityRole="tablist"
        onLayout={(event) => {
          width.current = event.nativeEvent.layout.width;
        }}
        style={[styles.row, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {days.map((day) => (
          <Pressable
            key={day.date}
            disabled={day.disabled}
            onPress={() => onSelectDate(day.date)}
            accessibilityRole="tab"
            accessibilityLabel={day.accessibilityLabel}
            accessibilityHint={day.selected ? 'Листайте календарь горизонтально по неделям' : undefined}
            accessibilityState={{ selected: day.selected, disabled: day.disabled }}
            accessibilityActions={
              day.selected
                ? [
                    { name: 'increment', label: 'Следующая неделя' },
                    ...(canGoPrevious
                      ? [{ name: 'decrement' as const, label: 'Предыдущая неделя' }]
                      : []),
                  ]
                : undefined
            }
            onAccessibilityAction={
              day.selected
                ? (event) => {
                    if (event.nativeEvent.actionName === 'increment') onNextWeek();
                    if (event.nativeEvent.actionName === 'decrement' && canGoPrevious) onPreviousWeek();
                  }
                : undefined
            }
            style={[
              styles.day,
              day.disabled && styles.disabledDay,
              day.selected && { backgroundColor: theme.brand },
            ]}
            testID={`week-day-${day.date}`}
          >
            <Text style={[styles.weekday, { color: day.selected ? theme.retryText : theme.textSecondary }]}>{day.weekday}</Text>
            <Text style={[styles.number, { color: day.selected ? theme.retryText : theme.textPrimary }]}>{day.dayNumber}</Text>
            <View style={[styles.marker, day.today && { backgroundColor: day.selected ? theme.retryText : theme.brand }]} testID={day.today ? 'today-marker' : undefined} />
          </Pressable>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { overflow: 'hidden', marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { flex: 1, minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, paddingVertical: 3 },
  disabledDay: { opacity: 0.35 },
  weekday: { fontSize: 12, lineHeight: 15 },
  number: { fontSize: 16, lineHeight: 19, fontWeight: '600' },
  marker: { width: 4, height: 4, borderRadius: 2, marginTop: 1, backgroundColor: 'transparent' },
});
