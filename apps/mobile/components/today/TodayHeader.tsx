import { StyleSheet, Text, View } from 'react-native';
import { ProgressRing } from '../ProgressRing';
import { WeekStrip } from '../WeekStrip';
import { useOrbitsTheme } from '../../theme/orbits';
import { greetingForDate } from './today-copy';

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
  canGoPrevious: boolean;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
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
        </View>
        {props.progressKnown ? (
          <ProgressRing completed={props.completed} total={props.total} size={52} />
        ) : null}
      </View>

      <WeekStrip
        selectedDate={props.selectedDateKey}
        todayDate={props.todayDateKey}
        canGoPrevious={props.canGoPrevious}
        onPreviousWeek={props.onPreviousWeek}
        onNextWeek={props.onNextWeek}
        onSelectDate={props.onSelectDate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 4,
    borderBottomWidth: 1,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  copy: { flex: 1 },
  greeting: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '700',
  },
  date: {
    fontSize: 14,
    lineHeight: 19,
    marginTop: 2,
    textTransform: 'capitalize',
  },
});
