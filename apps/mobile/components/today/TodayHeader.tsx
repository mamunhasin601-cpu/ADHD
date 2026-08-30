import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ProgressRing } from '../ProgressRing';
import { WeekStrip } from '../WeekStrip';
import { useOrbitsTheme } from '../../theme/orbits';
import { greetingForDate, progressSupport } from './today-copy';

type TodayHeaderProps = {
  isToday: boolean;
  now: Date;
  profileTimezone?: string | null;
  dateLabel: string;
  selectedDateKey: string;
  todayDateKey: string;
  progressKnown: boolean;
  completed: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onSelectDate: (date: string) => void;
};

export function TodayHeader(props: TodayHeaderProps) {
  const theme = useOrbitsTheme();

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: theme.surfacePrimary,
          borderBottomColor: theme.borderSubtle,
        },
      ]}
    >
      <View style={styles.hero}>
        <View style={styles.copy}>
          <Text style={[styles.greeting, { color: theme.textPrimary }]}>
            {greetingForDate(props.isToday, props.now, props.profileTimezone)}
          </Text>
          <Text style={[styles.date, { color: theme.textSecondary }]}>
            {props.dateLabel}
          </Text>
          {props.progressKnown ? (
            <Text style={[styles.support, { color: theme.textSecondary }]}>
              {progressSupport(props.completed, props.total)}
            </Text>
          ) : null}
        </View>
        {props.progressKnown ? (
          <ProgressRing completed={props.completed} total={props.total} size={72} />
        ) : null}
      </View>

      <View style={styles.navigation}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Предыдущий день"
          style={[styles.button, { backgroundColor: theme.surfaceMuted }]}
          onPress={props.onPrevious}
        >
          <Text style={[styles.arrow, { color: theme.brand }]}>‹</Text>
        </Pressable>
        {!props.isToday ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Вернуться к сегодняшнему дню"
            style={[styles.today, { backgroundColor: theme.activeSurface }]}
            onPress={props.onToday}
          >
            <Text style={{ color: theme.activeSurfaceText, fontWeight: '700' }}>
              Сегодня
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Следующий день"
          style={[styles.button, { backgroundColor: theme.surfaceMuted }]}
          onPress={props.onNext}
        >
          <Text style={[styles.arrow, { color: theme.brand }]}>›</Text>
        </Pressable>
      </View>

      <WeekStrip
        selectedDate={props.selectedDateKey}
        todayDate={props.todayDateKey}
        onSelectDate={props.onSelectDate}
      />
      <Text style={[styles.dayHeading, { color: theme.textPrimary }]}>Ваш день</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  copy: { flex: 1 },
  greeting: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
  },
  date: {
    fontSize: 15,
    lineHeight: 21,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  support: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  navigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    fontSize: 28,
    fontWeight: '600',
  },
  today: {
    minHeight: 44,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  dayHeading: {
    fontSize: 21,
    fontWeight: '700',
    marginTop: 18,
  },
});
