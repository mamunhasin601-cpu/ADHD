import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
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
  onOpenDatePicker: () => void;
};

export function TodayHeader(props: TodayHeaderProps) {
  const theme = useOrbitsTheme();

  return (
    <View
      testID="today-header"
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
          <Text testID="today-date-label" style={[styles.date, { color: theme.textSecondary }]}>
            {props.dateLabel}
          </Text>
        </View>
        <Pressable
          testID="date-picker-button"
          accessibilityRole="button"
          accessibilityLabel="Выбрать дату"
          accessibilityHint="Открывает календарь для перехода к другой дате"
          hitSlop={8}
          onPress={props.onOpenDatePicker}
          style={({ pressed }) => [
            styles.calendarButton,
            { backgroundColor: pressed ? theme.activeSurface : theme.surfaceMuted },
          ]}
        >
          <Svg width={28} height={28} viewBox="0 0 32 32" accessible={false}>
            <Path
              d="M8 5v4M23 5v4M5.5 11h20M19.5 26H7.5a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2h17a2 2 0 0 1 2 2v8"
              fill="none"
              stroke={theme.textSecondary}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="m19.5 25.5.7-3.7 6.5-6.5 3 3-6.5 6.5-3.7.7Z"
              fill="none"
              stroke={theme.textSecondary}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
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
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 8,
  },
  copy: { flexGrow: 1, flexShrink: 1, flexBasis: 168, minWidth: 0 },
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
  calendarButton: {
    width: 48,
    height: 48,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
