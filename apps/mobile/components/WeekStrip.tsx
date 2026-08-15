import { Pressable, StyleSheet, Text, View } from 'react-native';
import { addCalendarDays } from '../lib/timezone';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

export type WeekDayEntry = {
  date: string;
  weekday: (typeof WEEKDAYS)[number];
  dayNumber: number;
  selected: boolean;
  today: boolean;
  accessibilityLabel: string;
};

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
      accessibilityLabel: today ? `${fullDate}, сегодня` : fullDate,
    };
  });
}

type WeekStripProps = {
  selectedDate: string;
  todayDate: string;
  onSelectDate: (date: string) => void;
};

export function WeekStrip({ selectedDate, todayDate, onSelectDate }: WeekStripProps) {
  const days = buildWeekDays(selectedDate, todayDate);
  return (
    <View style={styles.row} accessibilityRole="tablist" testID="week-strip">
      {days.map((day) => (
        <Pressable
          key={day.date}
          onPress={() => onSelectDate(day.date)}
          accessibilityRole="tab"
          accessibilityLabel={day.accessibilityLabel}
          accessibilityState={{ selected: day.selected }}
          style={[styles.day, day.selected && styles.selectedDay]}
          testID={`week-day-${day.date}`}
        >
          <Text style={[styles.weekday, day.selected && styles.selectedText]}>{day.weekday}</Text>
          <Text style={[styles.number, day.selected && styles.selectedText]}>{day.dayNumber}</Text>
          <View style={[styles.marker, day.today && styles.todayMarker]} testID={day.today ? 'today-marker' : undefined} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  day: { flex: 1, minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, paddingVertical: 5 },
  selectedDay: { backgroundColor: '#6B5BFC' },
  weekday: { fontSize: 12, lineHeight: 16, color: '#6B7280' },
  number: { fontSize: 16, lineHeight: 20, fontWeight: '600', color: '#1F2937' },
  selectedText: { color: '#FFFFFF' },
  marker: { width: 4, height: 4, borderRadius: 2, marginTop: 2, backgroundColor: 'transparent' },
  todayMarker: { backgroundColor: '#A78BFA' },
});
