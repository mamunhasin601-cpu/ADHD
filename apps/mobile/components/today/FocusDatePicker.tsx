import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOrbitsTheme } from '../../theme/orbits';

type Props = {
  visible: boolean;
  selectedDate: string;
  todayDate: string;
  onClose: () => void;
  onConfirm: (date: string) => void;
};

type CalendarCell = {
  key: string;
  day: number | null;
  date: string | null;
};

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function parseDateKey(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function monthKey(year: number, month: number): string {
  return dateKey(year, month, 1);
}

function shiftMonth(value: string, amount: number): string {
  const { year, month } = parseDateKey(value);
  const shifted = new Date(Date.UTC(year, month - 1 + amount, 1, 12));
  return monthKey(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1);
}

function dateLabel(value: string): string {
  const { year, month, day } = parseDateKey(value);
  return new Date(Date.UTC(year, month - 1, day, 12)).toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function monthLabel(value: string): string {
  const { year, month } = parseDateKey(value);
  const label = new Date(Date.UTC(year, month - 1, 1, 12)).toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function buildFocusCalendarMonth(value: string): CalendarCell[] {
  const { year, month } = parseDateKey(value);
  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1, 12)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

  return Array.from({ length: cellCount }, (_, index) => {
    const day = index - firstWeekday + 1;
    if (day < 1 || day > daysInMonth) {
      return { key: `empty-${index}`, day: null, date: null };
    }
    return { key: dateKey(year, month, day), day, date: dateKey(year, month, day) };
  });
}

export function FocusDatePicker({
  visible,
  selectedDate,
  todayDate,
  onClose,
  onConfirm,
}: Props) {
  const theme = useOrbitsTheme();
  const [pendingDate, setPendingDate] = useState(selectedDate);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const { year, month } = parseDateKey(selectedDate);
    return monthKey(year, month);
  });

  useEffect(() => {
    if (!visible) return;
    const { year, month } = parseDateKey(selectedDate);
    setPendingDate(selectedDate);
    setVisibleMonth(monthKey(year, month));
  }, [selectedDate, visible]);

  const cells = useMemo(() => buildFocusCalendarMonth(visibleMonth), [visibleMonth]);

  return (
    <Modal
      testID="focus-date-picker-modal"
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          testID="focus-date-picker-scrim"
          pointerEvents="none"
          style={[styles.scrim, { backgroundColor: theme.elevationShadow }]}
        />
        <Pressable
          testID="focus-date-picker-backdrop"
          accessibilityRole="button"
          accessibilityLabel="Закрыть календарь"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
          <View
            testID="today-date-picker"
            accessibilityViewIsModal
            accessibilityLabel="Выбор даты"
            style={[
              styles.card,
              {
                backgroundColor: theme.surfacePrimary,
                borderColor: theme.borderSubtle,
                shadowColor: theme.elevationShadow,
              },
            ]}
          >
            <View style={[styles.accent, { backgroundColor: theme.activeSurface }]}>
              <Text style={[styles.eyebrow, { color: theme.activeBorder }]}>Выберите дату</Text>
              <Text style={[styles.selectedDate, { color: theme.textPrimary }]}>{dateLabel(pendingDate)}</Text>
            </View>

            <View style={styles.monthNavigation}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Предыдущий месяц"
                hitSlop={8}
                onPress={() => setVisibleMonth((value) => shiftMonth(value, -1))}
                style={({ pressed }) => [
                  styles.monthButton,
                  { backgroundColor: pressed ? theme.activeSurface : theme.surfaceMuted },
                ]}
              >
                <Text style={[styles.monthArrow, { color: theme.textPrimary }]}>‹</Text>
              </Pressable>
              <Text style={[styles.monthTitle, { color: theme.textPrimary }]}>{monthLabel(visibleMonth)}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Следующий месяц"
                hitSlop={8}
                onPress={() => setVisibleMonth((value) => shiftMonth(value, 1))}
                style={({ pressed }) => [
                  styles.monthButton,
                  { backgroundColor: pressed ? theme.activeSurface : theme.surfaceMuted },
                ]}
              >
                <Text style={[styles.monthArrow, { color: theme.textPrimary }]}>›</Text>
              </Pressable>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((weekday) => (
                <Text key={weekday} style={[styles.weekday, { color: theme.textSecondary }]}>{weekday}</Text>
              ))}
            </View>

            <View style={styles.daysGrid}>
              {cells.map((cell) => {
                if (!cell.date || cell.day === null) {
                  return <View key={cell.key} style={styles.dayCell} />;
                }
                const selected = cell.date === pendingDate;
                const today = cell.date === todayDate;
                return (
                  <View key={cell.key} style={styles.dayCell}>
                    <Pressable
                      testID={`focus-calendar-day-${cell.date}`}
                      accessibilityRole="button"
                      accessibilityLabel={dateLabel(cell.date)}
                      accessibilityState={{ selected }}
                      onPress={() => {
                        setPendingDate(cell.date!);
                        onConfirm(cell.date!);
                      }}
                      style={({ pressed }) => [
                        styles.dayButton,
                        today && !selected && { borderColor: theme.activeBorder, borderWidth: 1 },
                        selected && { backgroundColor: theme.brand },
                        pressed && !selected && { backgroundColor: theme.activeSurface },
                      ]}
                    >
                      <Text style={[
                        styles.dayText,
                        { color: selected ? theme.retryText : theme.textPrimary },
                        today && !selected && { color: theme.activeBorder, fontWeight: '800' },
                      ]}>
                        {cell.day}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>

            <View style={styles.actions}>
              <Pressable
                testID="focus-date-picker-cancel"
                accessibilityRole="button"
                accessibilityLabel="Отменить выбор даты"
                onPress={onClose}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { borderColor: theme.borderSubtle, backgroundColor: pressed ? theme.surfaceMuted : theme.surfacePrimary },
                ]}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.textSecondary }]}>Отмена</Text>
              </Pressable>
              <Pressable
                testID="focus-date-picker-confirm"
                accessibilityRole="button"
                accessibilityLabel="ОК"
                onPress={() => onConfirm(pendingDate)}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: pressed ? theme.brandPressed : theme.brand },
                ]}
              >
                <Text style={[styles.primaryButtonText, { color: theme.retryText }]}>ОК</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.6,
  },
  safeArea: {
    width: '100%',
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    elevation: 16,
  },
  accent: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  selectedDate: {
    marginTop: 4,
    fontSize: 24,
    lineHeight: 31,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  monthNavigation: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  monthButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthArrow: {
    fontSize: 30,
    lineHeight: 32,
    fontWeight: '500',
  },
  monthTitle: {
    flex: 1,
    paddingHorizontal: 8,
    textAlign: 'center',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
  },
  secondaryButton: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
});
