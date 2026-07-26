import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TIMELINE_CONFIG } from '../../lib/timeline-config';

function minutesFromDayStart(date: Date): number {
  return (date.getHours() - TIMELINE_CONFIG.dayStartHour) * 60 + date.getMinutes();
}

/** Красная линия "сейчас". Обновляется раз в минуту, скрывается вне видимого диапазона. */
export function NowIndicator() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const minutes = minutesFromDayStart(now);
  const totalMinutes = (TIMELINE_CONFIG.dayEndHour - TIMELINE_CONFIG.dayStartHour) * 60;
  if (minutes < 0 || minutes > totalMinutes) return null;

  const top = (minutes / 60) * TIMELINE_CONFIG.hourHeight;

  return (
    <View style={[styles.line, { top }]} pointerEvents="none">
      <View style={styles.dot} />
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    position: 'absolute',
    left: 56,
    right: 0,
    height: 2,
    backgroundColor: '#EF4444',
    zIndex: 10,
  },
  dot: {
    position: 'absolute',
    left: -5,
    top: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
});
