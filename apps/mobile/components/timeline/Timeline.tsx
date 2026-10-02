import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  GestureResponderEvent,
  LayoutAnimation,
  useWindowDimensions,
} from "react-native";
import { TIMELINE_CONFIG } from "../../lib/timeline-config";
import { computeTimelineConflictGroups, computeTimelineLayout } from "../../lib/timeline-layout";
import { NowIndicator } from "./NowIndicator";
import { TaskBlock } from "./TaskBlock";
import type { Task } from "@focus/shared-types";
import { useAuthStore } from "../../stores/auth.store";
import { formatWallClock, keepMeridiemTogether, uses12HourClock } from "../../lib/time-format";
import { getTimelineMinutesFromStart, getVisibleTimelineTop } from "../../lib/timeline-geometry";
import { computeTimelineFreeWindows } from "../../lib/timeline-free-windows";
import {
  formatTimelineFreeWindowAccessibilityLabel,
  formatTimelineFreeWindowDuration,
} from "../../lib/timeline-free-window-label";
import { PlanBlock } from "./PlanBlock";
import { taskKind } from "../../lib/task-kind";
import { useOrbitsTheme } from "../../theme/orbits";
import { TaskActionsSheet } from "./TaskActionsSheet";
import { computeElasticTimelineLayout, timelineGutterWidth } from "../../lib/timeline-elastic-layout";
import {
  resolveTimelineGutterCollisions,
  timelineGutterLabelHeight,
  timelineNowMarkerBounds,
  type GutterLabelBounds,
} from "../../lib/timeline-gutter-collisions";
import type { PlannedTaskPresentationState } from "../../lib/planned-now-state";

interface Props {
  tasks: Task[];
  onToggle: (id: string) => void;
  onOpenTask: (task: Task) => void;
  onMoveToThoughts?: (task: Task) => Promise<void>;
  onDeleteTask?: (task: Task) => Promise<void>;
  onCreateTask: () => void;
  shouldAutoScroll?: boolean;
  profileTimezone?: string | null;
  currentTaskId?: string;
  focusedTaskId?: string;
  renderFocusedTask?: (task: Task, onShowActions: () => void) => ReactNode;
  nowMs?: number;
  taskStates?: ReadonlyMap<string, PlannedTaskPresentationState>;
  onStartTask?: (taskId: string) => Promise<void> | void;
  isStartingTask?: boolean;
  startErrorForTask?: (taskId: string) => string | null;
}

const { dayStartHour, dayEndHour, hourHeight } = TIMELINE_CONFIG;
const hours = Array.from(
  { length: dayEndHour - dayStartHour },
  (_, i) => dayStartHour + i,
);
const totalHeight = hours.length * hourHeight;
const FOCUSED_TASK_HEIGHT = 220;
// Gesture slop only: coordinates never determine the new task's date or time.
const BACKGROUND_TAP_SLOP = 10;

export function Timeline({
  tasks,
  onToggle,
  onOpenTask,
  onMoveToThoughts,
  onDeleteTask,
  onCreateTask,
  shouldAutoScroll = true,
  profileTimezone,
  currentTaskId,
  focusedTaskId,
  renderFocusedTask,
  nowMs = Date.now(),
  taskStates,
  onStartTask,
  isStartingTask = false,
  startErrorForTask,
}: Props) {
  const theme = useOrbitsTheme();
  const { fontScale } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const backgroundTap = useRef<{ pageX: number; pageY: number } | null>(null);
  const [actionTask, setActionTask] = useState<Task | null>(null);
  const [viewportHeight, setViewportHeight] = useState(500);
  const now = useMemo(() => new Date(nowMs), [nowMs]);
  const [measuredFocusedHeight, setMeasuredFocusedHeight] = useState(0);
  const [measuredTaskHeights, setMeasuredTaskHeights] = useState<Record<string, number>>({});
  const [scrollTop, setScrollTop] = useState(0);
  const timeFormat = useAuthStore(
    (state) => state.user?.timeFormat ?? "SYSTEM",
  );
  const gutterWidth = timelineGutterWidth(uses12HourClock(timeFormat), fontScale);
  const contentScale = Math.max(1, Math.min(fontScale || 1, 2.5));
  const taskMinHeight = Math.ceil(72 + (contentScale - 1) * 38);
  const startedTaskMinHeight = Math.ceil(94 + (contentScale - 1) * 58);
  const planMinHeight = Math.ceil(80 + (contentScale - 1) * 42);
  const focusedFallbackHeight = Math.ceil(FOCUSED_TASK_HEIGHT + (contentScale - 1) * 96);
  const focusedTaskHeight = Math.max(focusedFallbackHeight, measuredFocusedHeight);
  const autoScrollGenerationRef = useRef(0);
  const scrolledTimezoneRef = useRef<string | null>(null);
  const pendingContentScrollRef = useRef<{ identity: string; y: number } | null>(null);
  const layout = useMemo(
    () => computeTimelineLayout(tasks, profileTimezone),
    [tasks, profileTimezone],
  );
  const conflictLabelTaskIds = useMemo(
    () => new Set(computeTimelineConflictGroups(tasks, profileTimezone).map((group) => group.labelTaskId)),
    [profileTimezone, tasks],
  );
  const freeWindows = useMemo(
    () => computeTimelineFreeWindows(tasks, profileTimezone),
    [tasks, profileTimezone],
  );
  const focusedTask = useMemo(
    () => tasks.find((task) => task.id === focusedTaskId && task.startTime && taskKind(task) === 'TASK' && !task.startedAt && !task.completedAt) ?? null,
    [focusedTaskId, tasks],
  );
  const activeStartedTaskId = useMemo(() => tasks
    .filter((task) => task.startedAt && !task.completedAt && task.durationMinutes && task.durationMinutes > 0)
    .sort((left, right) => new Date(right.startedAt!).getTime() - new Date(left.startedAt!).getTime())[0]?.id,
  [tasks]);
  useEffect(() => setMeasuredFocusedHeight(0), [focusedTask?.id]);
  const elasticLayout = useMemo(() => computeElasticTimelineLayout(
    tasks.flatMap((task) => {
      if (!task.startTime) return [];
      const startMinutes = getTimelineMinutesFromStart(new Date(task.startTime), profileTimezone);
      const baseTop = Math.max(0, (startMinutes / 60) * hourHeight);
      const baseHeight = task.durationMinutes === null
        ? TIMELINE_CONFIG.minBlockHeight
        : Math.max(1, (task.durationMinutes / 60) * hourHeight);
      return [{
        id: task.id,
        baseTop,
        baseHeight,
        minHeight: Math.max(
          measuredTaskHeights[task.id] ?? 0,
          task.id === focusedTask?.id
            ? focusedTaskHeight
            : taskKind(task) === 'TASK'
              ? task.startedAt && !task.completedAt && task.durationMinutes
                ? startedTaskMinHeight
                : taskMinHeight
              : planMinHeight,
        ),
      }];
    }),
  ), [focusedTask?.id, focusedTaskHeight, measuredTaskHeights, planMinHeight, profileTimezone, startedTaskMinHeight, taskMinHeight, tasks]);
  const focusedGeometry = useMemo(() => {
    if (!focusedTask?.startTime) return null;
    const startMinutes = getTimelineMinutesFromStart(new Date(focusedTask.startTime), profileTimezone);
    const baseTop = Math.max(0, (startMinutes / 60) * hourHeight);
    const baseHeight = Math.max(
      TIMELINE_CONFIG.minBlockHeight,
      focusedTask.durationMinutes === null
        ? TIMELINE_CONFIG.minBlockHeight
        : (focusedTask.durationMinutes / 60) * hourHeight,
    );
    const elastic = elasticLayout.geometry.get(focusedTask.id);
    return {
      top: elastic?.top ?? baseTop,
      end: baseTop + baseHeight,
      expansion: Math.max(0, (elastic?.height ?? focusedTaskHeight) - baseHeight),
    };
  }, [elasticLayout.geometry, focusedTask, focusedTaskHeight, profileTimezone]);
  const canvasHeight = totalHeight + elasticLayout.addedHeight + Math.ceil(16 * contentScale);

  const gutterCollisions = useMemo(() => {
    const labelHeight = timelineGutterLabelHeight(fontScale);
    const labels: GutterLabelBounds[] = [];
    for (const hour of hours) {
      if ((hour - dayStartHour) % 3 !== 0) continue;
      const baseTop = (hour - dayStartHour) * hourHeight;
      if (focusedGeometry && baseTop > focusedGeometry.top && baseTop < focusedGeometry.end) continue;
      labels.push({ id: `tick:${hour}`, kind: 'tick', top: elasticLayout.displayY(baseTop), height: labelHeight });
    }
    for (const task of tasks) {
      if (!task.startTime || taskKind(task) !== 'TASK' || layout.get(task.id)?.columnIndex !== 0) continue;
      const geometry = elasticLayout.geometry.get(task.id);
      if (!geometry) continue;
      labels.push({ id: `task:${task.id}`, kind: 'task', top: geometry.top + 4, height: labelHeight });
    }
    const nowBaseTop = shouldAutoScroll ? getVisibleTimelineTop(now, profileTimezone) : null;
    let startedTaskAtNow: Task | undefined;
    if (nowBaseTop !== null) {
      const nowTop = elasticLayout.displayY(nowBaseTop);
      startedTaskAtNow = tasks.find((task) => {
        if (!task.startedAt || task.completedAt || !task.startTime) return false;
        const geometry = elasticLayout.geometry.get(task.id);
        return Boolean(geometry && nowTop >= geometry.top && nowTop <= geometry.top + geometry.height);
      });
      const markerBounds = timelineNowMarkerBounds(nowTop, labelHeight);
      labels.push({
        id: startedTaskAtNow ? 'started-now' : 'now',
        kind: startedTaskAtNow ? 'started' : 'now',
        ...markerBounds,
      });
    }
    return {
      ...resolveTimelineGutterCollisions(labels),
      showNowBeacon: nowBaseTop !== null && !startedTaskAtNow,
    };
  }, [elasticLayout, focusedGeometry, fontScale, layout, now, profileTimezone, shouldAutoScroll, tasks]);

  function taskTop(task: Task): number {
    if (!task.startTime) return 0;
    const startMinutes = getTimelineMinutesFromStart(new Date(task.startTime), profileTimezone);
    return Math.max(0, (startMinutes / 60) * hourHeight);
  }

  function taskTimeLabel(task: Task): string {
    const startMinutes = getTimelineMinutesFromStart(new Date(task.startTime!), profileTimezone);
    const startClock = dayStartHour * 60 + startMinutes;
    return keepMeridiemTogether(formatWallClock(
      Math.floor(startClock / 60) % 24,
      ((startClock % 60) + 60) % 60,
      timeFormat,
    ));
  }

  const geometryIdentity = useMemo(
    () => tasks.map((task) => `${task.id}:${task.startTime ?? 'none'}:${task.durationMinutes ?? 'unknown'}:${task.startedAt ?? 'idle'}:${task.completedAt ?? 'open'}:${measuredTaskHeights[task.id] ?? 0}`).join('|') + `:${focusedTask?.id ?? 'none'}:${focusedTaskHeight}`,
    [focusedTask?.id, focusedTaskHeight, measuredTaskHeights, tasks],
  );

  useEffect(() => {
    LayoutAnimation.configureNext({
      duration: 260,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
  }, [geometryIdentity]);

  // Открытие экрана — сразу центрируем на "сейчас", а не показываем список/меню сверху
  // Но только если смотрим на сегодня (shouldAutoScroll)
  useEffect(() => {
    const generation = ++autoScrollGenerationRef.current;
    if (!shouldAutoScroll) {
      scrolledTimezoneRef.current = null;
      return;
    }

    const timezoneIdentity = `${profileTimezone ?? "__device_local__"}:${focusedTask?.id ?? '__now__'}`;
    if (scrolledTimezoneRef.current === timezoneIdentity) return;

    const nowTop = getVisibleTimelineTop(new Date(), profileTimezone);
    const y = focusedGeometry?.top ?? (nowTop === null ? null : elasticLayout.displayY(nowTop));
    if (y === null) return; // profile-local current time is outside the fixed range
    const targetY = Math.max(0, y - viewportHeight / 3);
    pendingContentScrollRef.current = { identity: timezoneIdentity, y: targetY };
    let ownsAutoScroll = true;
    const frame = requestAnimationFrame(() => {
      if (!ownsAutoScroll || autoScrollGenerationRef.current !== generation) return;
      scrollRef.current?.scrollTo({
        y: targetY,
        animated: false,
      });
      scrolledTimezoneRef.current = timezoneIdentity;
    });

    return () => {
      ownsAutoScroll = false;
      cancelAnimationFrame(frame);
      if (autoScrollGenerationRef.current === generation) {
        autoScrollGenerationRef.current += 1;
      }
    };
  }, [elasticLayout, focusedGeometry?.top, focusedTask?.id, profileTimezone, shouldAutoScroll, viewportHeight]);

  function handleContentSizeChange() {
    const pending = pendingContentScrollRef.current;
    if (!pending || !shouldAutoScroll) return;
    scrollRef.current?.scrollTo({ y: pending.y, animated: false });
    scrolledTimezoneRef.current = pending.identity;
    pendingContentScrollRef.current = null;
  }

  function cancelBackgroundTap() {
    backgroundTap.current = null;
  }

  function beginBackgroundTap(event: GestureResponderEvent) {
    const { pageX, pageY, touches } = event.nativeEvent;
    backgroundTap.current = Number.isFinite(pageX) && Number.isFinite(pageY) &&
      (!touches || touches.length === 1) ? { pageX, pageY } : null;
  }

  function trackBackgroundTap(event: GestureResponderEvent) {
    const start = backgroundTap.current;
    if (!start) return;
    const { pageX, pageY, touches } = event.nativeEvent;
    if (!Number.isFinite(pageX) || !Number.isFinite(pageY) ||
      (touches && touches.length > 1) ||
      Math.hypot(pageX - start.pageX, pageY - start.pageY) > BACKGROUND_TAP_SLOP) {
      cancelBackgroundTap();
    }
  }

  function releaseBackgroundTap(event: GestureResponderEvent) {
    trackBackgroundTap(event);
    const isTap = backgroundTap.current !== null;
    // Consume the gesture before navigation; repeated releases cannot create again.
    cancelBackgroundTap();
    if (isTap) onCreateTask();
  }

  return (
    <>
    <ScrollView
      ref={scrollRef}
      testID="timeline-scroll"
      style={styles.viewport}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
      onContentSizeChange={handleContentSizeChange}
      onScrollBeginDrag={cancelBackgroundTap}
      onMomentumScrollBegin={cancelBackgroundTap}
      scrollEventThrottle={120}
      onScroll={(event) => setScrollTop(Math.max(0, event.nativeEvent.contentOffset.y))}
    >
      <View testID="timeline-canvas" style={{ height: canvasHeight }}>
        {/* A sibling underneath the cards, never their responder ancestor. */}
        <View
          testID="timeline-create-background"
          style={StyleSheet.absoluteFillObject}
          accessible={false}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => false}
          onResponderGrant={beginBackgroundTap}
          onResponderStart={trackBackgroundTap}
          onResponderMove={trackBackgroundTap}
          onResponderRelease={releaseBackgroundTap}
          onResponderTerminationRequest={() => true}
          onResponderTerminate={cancelBackgroundTap}
        />
        {hours.map((hour) => {
          const isAnchor = (hour - dayStartHour) % 3 === 0;
          const baseTop = (hour - dayStartHour) * hourHeight;
          const hiddenInsideFocus = Boolean(
            focusedGeometry && baseTop > focusedGeometry.top && baseTop < focusedGeometry.end,
          );
          return (
          <View
            key={hour}
            testID={`timeline-hour-${hour}`}
            pointerEvents="none"
            style={[
              styles.hourRow,
              { top: elasticLayout.displayY(baseTop), height: hourHeight, opacity: hiddenInsideFocus || gutterCollisions.hiddenIds.has(`tick:${hour}`) ? 0 : 1 },
            ]}
          >
            {isAnchor ? (
              <>
                <Text numberOfLines={1} style={[styles.hourLabel, { color: theme.textSecondary, width: gutterWidth - 4 }]}>
                  {keepMeridiemTogether(formatWallClock(hour % 24, 0, timeFormat))}
                </Text>
                <View style={[styles.hourAnchor, { backgroundColor: theme.timelineNeutral }]} />
              </>
            ) : null}
          </View>
          );
        })}

        {freeWindows.map((window) => {
          const label = `${formatTimelineFreeWindowDuration(window.durationMinutes)} свободно`;
          const accessibilityLabel =
            formatTimelineFreeWindowAccessibilityLabel(window, timeFormat);
          return (
            <View
              key={`${window.startMinutes}-${window.endMinutes}`}
              testID={`timeline-free-window-${window.startMinutes}-${window.endMinutes}`}
              pointerEvents="none"
              accessible
              accessibilityLabel={accessibilityLabel}
              style={[
                styles.freeWindow,
                {
                  left: gutterWidth,
                  top: elasticLayout.displayY(window.top),
                  height: Math.max(28, elasticLayout.displayY(window.top + window.height) - elasticLayout.displayY(window.top)),
                },
              ]}
            >
              <View style={[styles.freeWindowPill, { backgroundColor: theme.surfaceMuted }]}>
                <Text style={[styles.freeWindowFold, { color: theme.activeBorder }]}>⌃⌄</Text>
                <Text style={[styles.freeWindowLabel, { color: theme.textSecondary }]}>{label}</Text>
              </View>
            </View>
          );
        })}

        {shouldAutoScroll && (
          <NowIndicator
            profileTimezone={profileTimezone}
            timeFormat={timeFormat}
            mapTop={elasticLayout.displayY}
            gutterWidth={gutterWidth}
            nowMs={nowMs}
            showBeacon={gutterCollisions.showNowBeacon}
          />
        )}

        {tasks.map((task) => {
          const taskLayout = layout.get(task.id);
          if (task.id === focusedTask?.id && renderFocusedTask) {
            return (
              <View
                key={task.id}
                testID={`timeline-focused-task-${task.id}`}
                style={[styles.focusedRow, { top: focusedGeometry?.top ?? taskTop(task), height: focusedTaskHeight }]}
                pointerEvents="box-none"
              >
                <View style={[styles.timePill, { backgroundColor: theme.surfaceMuted, width: gutterWidth - 8, opacity: gutterCollisions.hiddenIds.has(`task:${task.id}`) ? 0 : 1 }]} pointerEvents="none">
                  <Text numberOfLines={1} style={[styles.timeText, { color: theme.textSecondary }]}>{taskTimeLabel(task)}</Text>
                </View>
                <View
                  style={[styles.focusedCard, { left: gutterWidth }]}
                  onLayout={(event) => {
                    const nextHeight = Math.ceil(event.nativeEvent.layout.height);
                    if (nextHeight > 0 && nextHeight !== measuredFocusedHeight) setMeasuredFocusedHeight(nextHeight);
                  }}
                >{renderFocusedTask(task, () => setActionTask(task))}</View>
              </View>
            );
          }
          const elasticGeometry = elasticLayout.geometry.get(task.id);
          if (taskKind(task) !== "TASK") {
            return (
              <PlanBlock
                key={task.id}
                task={task}
                onOpen={onOpenTask}
                timeFormat={timeFormat}
                columnIndex={taskLayout?.columnIndex}
                columnCount={taskLayout?.columnCount}
                profileTimezone={profileTimezone}
                layoutTop={elasticGeometry?.top}
                layoutHeight={elasticGeometry?.height}
                gutterWidth={gutterWidth}
              />
            );
          }
          return (
            <TaskBlock
              key={task.id}
              task={task}
              onToggle={onToggle}
              onOpen={onOpenTask}
              onShowActions={onMoveToThoughts || onDeleteTask ? setActionTask : onOpenTask}
              timeFormat={timeFormat}
              columnIndex={taskLayout?.columnIndex}
              columnCount={taskLayout?.columnCount}
              isCurrent={task.id === currentTaskId}
              presentationState={taskStates?.get(task.id)}
              showScheduleConflict={conflictLabelTaskIds.has(task.id)}
              onStart={onStartTask}
              isStarting={isStartingTask}
              startError={startErrorForTask?.(task.id) ?? null}
              profileTimezone={profileTimezone}
              layoutTop={elasticGeometry?.top}
              layoutHeight={elasticGeometry?.height}
              gutterWidth={gutterWidth}
              showTimeLabel={!gutterCollisions.hiddenIds.has(`task:${task.id}`)}
              nowMs={nowMs}
              animateElapsed={task.id === activeStartedTaskId && Boolean(
                elasticGeometry && elasticGeometry.top + elasticGeometry.height >= scrollTop &&
                elasticGeometry.top <= scrollTop + viewportHeight
              )}
              onMeasuredHeight={(taskId, height) => {
                setMeasuredTaskHeights((current) => current[taskId] === height
                  ? current
                  : { ...current, [taskId]: height });
              }}
            />
          );
        })}
      </View>
    </ScrollView>
    <TaskActionsSheet
      task={actionTask}
      visible={actionTask !== null}
      onClose={() => setActionTask(null)}
      onReschedule={onOpenTask}
      onMoveToThoughts={async (task) => {
        if (!onMoveToThoughts) return;
        await onMoveToThoughts(task);
      }}
      onDelete={async (task) => {
        if (!onDeleteTask) return;
        await onDeleteTask(task);
      }}
    />
    </>
  );
}

const styles = StyleSheet.create({
  viewport: { height: 500, minHeight: 380 },
  focusedRow: {
    position: 'absolute',
    left: 0,
    right: 8,
    zIndex: 12,
  },
  focusedCard: {
    position: 'absolute',
    left: 58,
    right: 0,
    top: 0,
  },
  timePill: {
    position: 'absolute',
    left: 4,
    top: 4,
    width: 50,
    minHeight: 24,
    paddingHorizontal: 5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  hourRow: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  hourLabel: {
    width: 54,
    fontSize: 11,
    color: "#9CA3AF",
    paddingLeft: 4,
  },
  hourAnchor: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 5,
  },
  freeWindow: {
    position: "absolute",
    left: 58,
    right: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  freeWindowPill: {
    minHeight: 28,
    maxWidth: 190,
    paddingHorizontal: 12,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  freeWindowFold: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
  },
  freeWindowLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6B7280",
  },
});
