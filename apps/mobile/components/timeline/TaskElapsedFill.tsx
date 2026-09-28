import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  clampTaskProgress,
  diagonalProgressPath,
  shouldAnimateTaskProgress,
} from '../../lib/task-progress-fill';

type Props = {
  taskId: string;
  progress: number;
  startedAt: Date | string | null;
  color: string;
  animationEnabled: boolean;
  animateOnMount?: boolean;
};

type Frame = { progress: number; wave: number };

/** One finite settling wave; hydrated progress is painted immediately. */
export function TaskElapsedFill({
  taskId,
  progress,
  startedAt,
  color,
  animationEnabled,
  animateOnMount = false,
}: Props) {
  const targetProgress = clampTaskProgress(progress);
  const startedIdentity = startedAt ? new Date(startedAt).toISOString() : null;
  const previousProgress = useRef(animateOnMount ? 0 : targetProgress);
  const previousStartedAt = useRef<string | null>(animateOnMount ? null : startedIdentity);
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const [frame, setFrame] = useState<Frame>({ progress: targetProgress, wave: 0 });
  const reduceMotionRef = useRef(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [appIsActive, setAppIsActive] = useState(
    AppState.currentState !== 'background' && AppState.currentState !== 'inactive',
  );

  useEffect(() => {
    let mounted = true;
    Promise.resolve(AccessibilityInfo.isReduceMotionEnabled?.()).then((enabled) => {
      const next = Boolean(enabled);
      if (mounted && next !== reduceMotionRef.current) {
        reduceMotionRef.current = next;
        setReduceMotion(next);
      }
    });
    const reduceMotionSubscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (enabled) => {
      reduceMotionRef.current = enabled;
      setReduceMotion(enabled);
    });
    const appStateSubscription = AppState.addEventListener('change', (state) => setAppIsActive(state === 'active'));
    return () => {
      mounted = false;
      reduceMotionSubscription?.remove();
      appStateSubscription.remove();
    };
  }, []);

  useEffect(() => {
    const oldProgress = previousProgress.current;
    const oldStartedAt = previousStartedAt.current;
    previousProgress.current = targetProgress;
    previousStartedAt.current = startedIdentity;
    animation.current?.stop();

    const animate = shouldAnimateTaskProgress({
      previousProgress: oldProgress,
      nextProgress: targetProgress,
      previousStartedAt: oldStartedAt,
      nextStartedAt: startedIdentity,
      animationEnabled,
      appIsActive,
      reduceMotion,
    });
    if (!animate) {
      setFrame((current) => current.progress === targetProgress && current.wave === 0
        ? current
        : { progress: targetProgress, wave: 0 });
      return;
    }

    const progressValue = new Animated.Value(oldProgress);
    const waveValue = new Animated.Value(0);
    const progressListener = progressValue.addListener(({ value }) => {
      setFrame((current) => ({ ...current, progress: clampTaskProgress(value) }));
    });
    const waveListener = waveValue.addListener(({ value }) => {
      setFrame((current) => ({ ...current, wave: value }));
    });
    const settling = Animated.parallel([
      Animated.timing(progressValue, {
        toValue: targetProgress,
        duration: 900,
        useNativeDriver: false,
      }),
      Animated.sequence([
        Animated.timing(waveValue, { toValue: 1, duration: 260, useNativeDriver: false }),
        Animated.timing(waveValue, { toValue: -0.65, duration: 320, useNativeDriver: false }),
        Animated.timing(waveValue, { toValue: 0, duration: 520, useNativeDriver: false }),
      ]),
    ]);
    animation.current = settling;
    settling.start(() => {
      progressValue.removeListener(progressListener);
      waveValue.removeListener(waveListener);
      setFrame({ progress: targetProgress, wave: 0 });
      animation.current = null;
    });
    return () => {
      settling.stop();
      progressValue.removeListener(progressListener);
      waveValue.removeListener(waveListener);
    };
  }, [animationEnabled, appIsActive, reduceMotion, startedIdentity, targetProgress]);

  return (
    <View
      testID={`task-elapsed-fill-${taskId}`}
      accessible={false}
      pointerEvents="none"
      style={StyleSheet.absoluteFillObject}
    >
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Path
          testID={`task-elapsed-fill-path-${taskId}`}
          d={diagonalProgressPath(frame.progress, 100, 100, frame.wave * 3.5)}
          fill={color}
        />
      </Svg>
    </View>
  );
}
