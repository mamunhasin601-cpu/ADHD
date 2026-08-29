import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useOrbitsTheme } from '../theme/orbits';

type ProgressRingProps = {
  completed: number;
  total: number;
  size?: number;
  strokeWidth?: number;
};

export function normalizeProgress(completed: number, total: number) {
  const safeTotal = Math.max(0, Number.isFinite(total) ? Math.floor(total) : 0);
  const safeCompleted = Math.min(
    safeTotal,
    Math.max(0, Number.isFinite(completed) ? Math.floor(completed) : 0),
  );
  return {
    completed: safeCompleted,
    total: safeTotal,
    percent: safeTotal ? Math.round((safeCompleted / safeTotal) * 100) : 0,
  };
}

export function ProgressRing({
  completed,
  total,
  size = 48,
  strokeWidth = 4,
}: ProgressRingProps) {
  const theme = useOrbitsTheme();
  const progress = normalizeProgress(completed, total);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const label = progress.total === 0
    ? 'Прогресс дня: задач пока нет'
    : `Прогресс дня: выполнено ${progress.completed} из ${progress.total}, ${progress.percent} процентов`;
  const accent = progress.total > 0 && progress.completed === progress.total
    ? theme.rewardPrimary
    : theme.completionPrimary;
  const visibleValue = progress.total === 0
    ? '0 задач'
    : `${progress.completed} из ${progress.total}`;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{
        min: 0,
        max: 100,
        now: progress.percent,
        text: progress.total === 0 ? 'Задач пока нет' : visibleValue,
      }}
      style={[styles.container, { width: size, height: size }]}
    >
      <Svg width={size} height={size} style={styles.svg}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.timelineNeutral}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={accent}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress.percent / 100)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={[styles.text, { color: theme.textPrimary }]}>{visibleValue}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  svg: { position: 'absolute' },
  text: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});
