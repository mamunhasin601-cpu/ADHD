import { useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  GestureResponderEvent,
} from "react-native";
import { TIMELINE_CONFIG } from "../../lib/timeline-config";
import { computeTimelineLayout } from "../../lib/timeline-layout";
import { NowIndicator } from "./NowIndicator";
import { TaskBlock } from "./TaskBlock";
import type { Task } from "@focus/shared-types";
import { useAuthStore } from "../../stores/auth.store";
import { formatWallClock } from "../../lib/time-format";
import { calendarDayWallTimeToInstant, toCanonicalDateParam } from "../../lib/timezone";
import { getVisibleTimelineTop } from "../../lib/timeline-geometry";

interface Props {
  tasks: Task[];
  onToggle: (id: string) => void;
  onOpenTask: (task: Task) => void;
  onCreateAt: (startTime: Date) => void;
  shouldAutoScroll?: boolean;
  currentDate?: Date;
  currentDateKey?: string;
  profileTimezone?: string | null;
  currentTaskId?: string;
}

const { dayStartHour, dayEndHour, hourHeight } = TIMELINE_CONFIG;
const hours = Array.from(
  { length: dayEndHour - dayStartHour },
  (_, i) => dayStartHour + i,
);
const totalHeight = hours.length * hourHeight;

export function Timeline({
  tasks,
  onToggle,
  onOpenTask,
  onCreateAt,
  shouldAutoScroll = true,
  currentDate = new Date(),
  currentDateKey,
  profileTimezone,
  currentTaskId,
}: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const timeFormat = useAuthStore(
    (state) => state.user?.timeFormat ?? "SYSTEM",
  );
  const autoScrollGenerationRef = useRef(0);
  const scrolledTimezoneRef = useRef<string | null>(null);
  const layout = useMemo(
    () => computeTimelineLayout(tasks, profileTimezone),
    [tasks, profileTimezone],
  );

  // Открытие экрана — сразу центрируем на "сейчас", а не показываем список/меню сверху
  // Но только если смотрим на сегодня (shouldAutoScroll)
  useEffect(() => {
    const generation = ++autoScrollGenerationRef.current;
    if (!shouldAutoScroll) {
      scrolledTimezoneRef.current = null;
      return;
    }

    const timezoneIdentity = profileTimezone ?? "__device_local__";
    if (scrolledTimezoneRef.current === timezoneIdentity) return;

    const y = getVisibleTimelineTop(new Date(), profileTimezone);
    if (y === null) return; // profile-local current time is outside the fixed range
    const viewportHeight = Dimensions.get("window").height;
    let ownsAutoScroll = true;
    const frame = requestAnimationFrame(() => {
      if (!ownsAutoScroll || autoScrollGenerationRef.current !== generation) return;
      scrollRef.current?.scrollTo({
        y: Math.max(0, y - viewportHeight / 2.5),
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
  }, [profileTimezone, shouldAutoScroll]);

  function handleBackgroundPress(event: GestureResponderEvent) {
    const y = event.nativeEvent.locationY;
    const minutesFromStart = (y / hourHeight) * 60;

    const roundedMinutes = Math.round(minutesFromStart / 15) * 15;
    const totalMinutes = dayStartHour * 60 + roundedMinutes;
    const start = calendarDayWallTimeToInstant(
      currentDateKey ?? toCanonicalDateParam(currentDate, profileTimezone),
      Math.floor(totalMinutes / 60),
      totalMinutes % 60,
      profileTimezone,
    );
    onCreateAt(start);
  }

  return (
    <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
      <View
        style={{ height: totalHeight }}
        onStartShouldSetResponder={() => true}
        onResponderRelease={handleBackgroundPress}
      >
        {hours.map((hour) => (
          <View
            key={hour}
            testID={`timeline-hour-${hour}`}
            style={[
              styles.hourRow,
              { top: (hour - dayStartHour) * hourHeight, height: hourHeight },
            ]}
          >
            <Text style={styles.hourLabel}>
              {formatWallClock(hour % 24, 0, timeFormat)}
            </Text>
            <View style={styles.hourLine} />
          </View>
        ))}

        {shouldAutoScroll && <NowIndicator profileTimezone={profileTimezone} />}

        {tasks.map((task) => {
          const taskLayout = layout.get(task.id);
          return (
            <TaskBlock
              key={task.id}
              task={task}
              onToggle={onToggle}
              onOpen={onOpenTask}
              columnIndex={taskLayout?.columnIndex}
              columnCount={taskLayout?.columnCount}
              isCurrent={task.id === currentTaskId}
              profileTimezone={profileTimezone}
            />
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hourRow: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  hourLabel: {
    width: 72,
    fontSize: 12,
    color: "#9CA3AF",
    paddingLeft: 4,
  },
  hourLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
    marginTop: 6,
  },
});
