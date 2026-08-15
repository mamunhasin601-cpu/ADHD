import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { getVisibleTimelineTop } from '../../lib/timeline-geometry';

/** Красная линия "сейчас". Обновляется раз в минуту, скрывается вне видимого диапазона. */
export function NowIndicator({ profileTimezone }: { profileTimezone?: string | null }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const top = getVisibleTimelineTop(now, profileTimezone);
  if (top === null) return null;

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
