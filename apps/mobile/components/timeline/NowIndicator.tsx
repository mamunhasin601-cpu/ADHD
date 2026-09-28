import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import type { TimeFormat } from '@focus/shared-types';
import { getTimelineWallClock, getVisibleTimelineTop } from '../../lib/timeline-geometry';
import { formatWallClock, keepMeridiemTogether } from '../../lib/time-format';
import { useOrbitsTheme } from '../../theme/orbits';

/** A compact Orbit beacon replaces the spreadsheet-like full-width red line. */
export function NowIndicator({
  profileTimezone,
  timeFormat = 'SYSTEM',
  topOffset = 0,
  mapTop,
  gutterWidth = 58,
  nowMs = Date.now(),
  showBeacon = true,
}: {
  profileTimezone?: string | null;
  timeFormat?: TimeFormat;
  topOffset?: number;
  mapTop?: (baseTop: number) => number;
  gutterWidth?: number;
  nowMs?: number;
  showBeacon?: boolean;
}) {
  const theme = useOrbitsTheme();
  const now = new Date(nowMs);
  const initialBaseTop = getVisibleTimelineTop(now, profileTimezone) ?? 0;
  const initialTop = mapTop ? mapTop(initialBaseTop) : initialBaseTop + topOffset;
  const animatedTop = useRef(new Animated.Value(initialTop)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const previousTop = useRef<number | null>(initialTop);

  const timelineTop = getVisibleTimelineTop(now, profileTimezone);
  const top = timelineTop === null ? null : mapTop ? mapTop(timelineTop) : timelineTop + topOffset;
  useEffect(() => {
    if (top === null) return;
    if (previousTop.current === top) return;
    previousTop.current = top;
    const animation = Animated.parallel([
      Animated.timing(animatedTop, {
        toValue: top,
        duration: 320,
        useNativeDriver: false,
      }),
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.24, duration: 180, useNativeDriver: true }),
        Animated.spring(pulse, { toValue: 1, damping: 12, stiffness: 180, useNativeDriver: true }),
      ]),
    ]);
    animation.start();
    return () => animation.stop();
  }, [animatedTop, pulse, top]);

  if (top === null || !showBeacon) return null;
  const wallClock = getTimelineWallClock(now, profileTimezone);
  const label = keepMeridiemTogether(formatWallClock(wallClock.hours, wallClock.minutes, timeFormat));

  return (
    <Animated.View
      testID="timeline-now-indicator"
      accessible
      accessibilityLabel={`Сейчас ${label}`}
      style={[styles.container, { top: animatedTop }]}
      pointerEvents="none"
    >
      <View style={[styles.timePill, { backgroundColor: theme.activeSurface, width: gutterWidth - 7 }]}>
        <Text numberOfLines={1} style={[styles.timeText, { color: theme.activeBorder }]}>{label}</Text>
      </View>
      <Animated.View
        testID="timeline-now-orbit"
        style={[
          styles.orbit,
          {
            borderColor: theme.activeBorder,
            backgroundColor: theme.background,
            // Keep the complete marker inside the gutter; no line or circle may
            // cross the task-card border at x = gutterWidth.
            left: gutterWidth - 18,
            transform: [{ scale: pulse }],
          },
        ]}
      >
        <View style={[styles.core, { backgroundColor: theme.brand }]} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    zIndex: 20,
  },
  timePill: {
    position: 'absolute',
    left: 3,
    top: -12,
    width: 51,
    minHeight: 25,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  timeText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
  },
  orbit: {
    position: 'absolute',
    left: 55,
    top: -8,
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  core: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
