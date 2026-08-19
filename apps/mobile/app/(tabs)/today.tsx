import { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Timeline } from '../../components/timeline/Timeline';
import { NowCard } from '../../components/NowCard';
import { ProgressRing } from '../../components/ProgressRing';
import { EmptyState } from '../../components/EmptyState';
import { RecoverySection } from '../../components/RecoverySection';
import {
  useTasksForDate,
  useCreateTask,
  useToggleTask,
  useStartTask,
  useUpdateTask,
} from '../../lib/api/tasks';
import { useAuthStore } from '../../stores/auth.store';
import {
  addCalendarDays,
  isValidIANATimezone,
  localMidnightToInstant,
  toCanonicalDateParam,
} from '../../lib/timezone';
import type { Task } from '@focus/shared-types';
import { findCurrentTask } from '../../lib/current-task';
import { NotificationInvitation } from '../../components/NotificationInvitation';
import { WeekStrip } from '../../components/WeekStrip';
import { useNotificationLifecycle } from '../../lib/notification-lifecycle';
import { useGlobalCapture } from '../../components/GlobalCapture';
import { isTaskRecord } from '../../lib/task-kind';

/**
 * Экран "Сегодня" — главный экран таймлайна дня.
 * Открывается сразу на "сейчас" (см. Timeline), а не на списке/меню — по UX-заметкам.
 */
export default function TodayScreen() {
  const router = useRouter();
  const { openTimelineCapture } = useGlobalCapture();
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Raw profile IANA timezone. May be undefined before the profile loads or
  // invalid if the stored value is corrupt. Never substituted with UTC for
  // Recovery — RecoverySection owns that guard (Task 0006C/0007A).
  const profileTimezone = useAuthStore((s) => s.user?.timezone);
  const timeFormat = useAuthStore((s) => s.user?.timeFormat ?? 'SYSTEM');
  const hasCompletedOnboarding = useAuthStore((s) => Boolean(s.user?.hasCompletedOnboarding));
  const notificationLifecycle = useNotificationLifecycle();

  // isToday for the non-Recovery parts of Today (progress ring, Now/Next,
  // timeline autoscroll). Both sides go through the canonical date helper, so
  // the comparison uses the profile timezone when it is valid and the DEVICE
  // calendar day otherwise — never UTC (Task 0007A).
  const isToday = useMemo(
    () =>
      toCanonicalDateParam(selectedDate, profileTimezone) ===
      toCanonicalDateParam(new Date(), profileTimezone),
    [selectedDate, profileTimezone],
  );

  const selectedDateKey = toCanonicalDateParam(selectedDate, profileTimezone);
  const todayDateKey = toCanonicalDateParam(new Date(), profileTimezone);

  function instantForCalendarDay(date: string): Date {
    if (profileTimezone && isValidIANATimezone(profileTimezone)) {
      return localMidnightToInstant(date, profileTimezone);
    }
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  function selectCalendarDay(date: string) {
    setSelectedDate(instantForCalendarDay(date));
  }

  const [selectedYear, selectedMonth, selectedDay] = selectedDateKey.split('-').map(Number);
  const dateLabel = new Date(Date.UTC(selectedYear, selectedMonth - 1, selectedDay, 12)).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });

  // Profile timezone is passed so the Today query key and its `?date=` param
  // resolve to the same canonical day that Recovery invalidates (Task 0007A).
  const {
    data: tasks = [],
    isLoading,
    isError,
  } = useTasksForDate(selectedDate, profileTimezone);

  const [currentTime, setCurrentTime] = useState(new Date());

  // Обновляем время каждую минуту для актуализации Now/Next
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // каждую минуту
    return () => clearInterval(interval);
  }, []);

  const taskRecords = tasks.filter(isTaskRecord);
  const scheduledTasks = taskRecords.filter((task: Task) => task.startTime && !task.completedAt);
  const unscheduledTasks = taskRecords.filter((task: Task) => !task.startTime);
  const timelineEntries = tasks.filter((task: Task) => task.startTime);

  // Прогресс дня: завершенные / все задачи
  const completedCount = taskRecords.filter((task: Task) => task.completedAt).length;
  const totalCount = taskRecords.length;
  const hasPlanEntries = tasks.length > 0;

  // Known durations use their real end. Unknown durations remain current until
  // the next scheduled task (or the end of the profile-local Today view).
  const currentTask = useMemo(() => {
    if (!isToday) return null;
    const currentDay = toCanonicalDateParam(currentTime, profileTimezone);
    const dayEnd = profileTimezone && isValidIANATimezone(profileTimezone)
      ? localMidnightToInstant(addCalendarDays(currentDay, 1), profileTimezone)
      : (() => {
          const deviceDayEnd = new Date(currentTime);
          deviceDayEnd.setHours(24, 0, 0, 0);
          return deviceDayEnd;
        })();
    return findCurrentTask(scheduledTasks, currentTime, dayEnd);
  }, [scheduledTasks, currentTime, isToday, profileTimezone]);

  // Следующая задача: startTime > now, ближайшая
  const nextTask = useMemo(() => {
    if (!isToday) return null;
    const now = currentTime.getTime();
    const upcoming = scheduledTasks
      .filter((task: Task) => new Date(task.startTime!).getTime() > now)
      .sort((a: Task, b: Task) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime());
    return upcoming[0] || null;
  }, [scheduledTasks, currentTime, isToday]);
  // Same canonical key as the Today query and Recovery invalidation (0007A).
  const createTask = useCreateTask(selectedDate, profileTimezone);
  const toggleTask = useToggleTask(selectedDate, profileTimezone);
  const startTask = useStartTask(selectedDate, profileTimezone);
  const updateTask = useUpdateTask(selectedDate, profileTimezone);
  const startSubmissionPending = useRef(false);
  const [startError, setStartError] = useState<{
    taskId: string;
    dateKey: string;
    message: string;
  } | null>(null);

  async function handleStart(taskId: string) {
    if (startSubmissionPending.current || startTask.isPending) return;
    startSubmissionPending.current = true;
    setStartError(null);
    try {
      await startTask.mutateAsync(taskId);
    } catch {
      setStartError({
        taskId,
        dateKey: toCanonicalDateParam(selectedDate, profileTimezone),
        message: 'Не удалось начать задачу. Проверьте соединение и попробуйте снова.',
      });
    } finally {
      startSubmissionPending.current = false;
    }
  }


  function openTask(task: Task) {
    router.push({
      pathname: '/task-form',
      params: {
        task: JSON.stringify(task),
        selectedDate: selectedDate.toISOString(),
        selectedDateKey,
      },
    });
  }


  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Focus</Text>
          {isToday && totalCount > 0 && (
            <ProgressRing completed={completedCount} total={totalCount} />
          )}
          {!isToday && (
            <Pressable
              onPress={() => selectCalendarDay(todayDateKey)}
              style={styles.todayButton}
            >
              <Text style={styles.todayButtonText}>Сегодня</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.dateNav}>
          <Pressable
            onPress={() => {
              selectCalendarDay(addCalendarDays(selectedDateKey, -1));
            }}
            style={styles.navButton}
          >
            <Text style={styles.navButtonText}>‹</Text>
          </Pressable>
          <Text style={styles.headerDate}>{dateLabel}</Text>
          <Pressable
            onPress={() => {
              selectCalendarDay(addCalendarDays(selectedDateKey, 1));
            }}
            style={styles.navButton}
          >
            <Text style={styles.navButtonText}>›</Text>
          </Pressable>
        </View>
        <WeekStrip
          selectedDate={selectedDateKey}
          todayDate={todayDateKey}
          onSelectDate={selectCalendarDay}
        />
      </View>

      {isLoading && (
        <View style={styles.centered}>
          <ActivityIndicator color="#6B5BFC" />
        </View>
      )}

      {isError && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>
            Не удалось загрузить задачи. Потяните вниз, чтобы обновить.
          </Text>
        </View>
      )}

      {!isLoading && !isError && !hasPlanEntries && (
        <EmptyState
          emoji="🌅"
          title={isToday ? "Начни свой день" : "На этот день нет задач"}
          description={
            isToday
              ? "Добавь первую задачу, чтобы начать планирование. Нажми + внизу или коснись таймлайна."
              : "На этот день пока нет задач. Создай задачу или вернись к сегодняшнему дню."
          }
          actionLabel="Создать задачу"
          onAction={() =>
            router.push({
              pathname: '/task-form',
              params: { selectedDate: selectedDate.toISOString(), selectedDateKey },
            })
          }
        />
      )}

      {/* Recovery — production coordinator owns timezone guard, query,
          mutation, banner lifecycle and the Today-level partial notice. */}
      {isToday && (
        <RecoverySection
          selectedDate={selectedDate}
          profileTimezone={profileTimezone}
          onTimezoneInvalid={() => router.push('/settings')}
        />
      )}

      {!isLoading && !isError && hasPlanEntries && (
        <>
          {isToday && (currentTask || nextTask) && (
            <><NowCard
              task={currentTask ?? nextTask!}
              mode={currentTask ? 'current' : 'upcoming'}
              onComplete={(taskId) => toggleTask.mutate(taskId)}
              onStart={handleStart}
              onOpenTask={openTask}
              onSaveFirstStep={async (taskId, firstStep) => updateTask.mutateAsync({ id: taskId, dto: { firstStep } })}
              isCompleting={toggleTask.isPending}
              isStarting={startTask.isPending}
              isSavingFirstStep={updateTask.isPending}
              startError={
                startError &&
                startError.taskId === (currentTask ?? nextTask!).id &&
                startError.dateKey === toCanonicalDateParam(selectedDate, profileTimezone)
                  ? startError.message
                  : null
              }
            />
            {hasCompletedOnboarding && notificationLifecycle.permission === 'not-asked' && notificationLifecycle.invitation === 'available' && (
              <NotificationInvitation />
            )}</>
          )}
          {unscheduledTasks.length > 0 && (
            <View style={styles.unscheduledList}>
              {unscheduledTasks.map((task: Task) => (
                <Pressable
                  key={task.id}
                  style={styles.unscheduledItem}
                  onPress={() => toggleTask.mutate(task.id)}
                  onLongPress={() =>
                    router.push({
                      pathname: '/task-form',
                      params: {
                        task: JSON.stringify(task),
                        selectedDate: selectedDate.toISOString(),
                        selectedDateKey,
                      },
                    })
                  }
                >
                  <View
                    style={[
                      styles.unscheduledDot,
                      { backgroundColor: task.completedAt ? '#E5E7EB' : task.color },
                    ]}
                  />
                  <Text
                    style={[
                      styles.unscheduledText,
                      !!task.completedAt && styles.unscheduledTextDone,
                    ]}
                    numberOfLines={1}
                  >
                    {task.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          {timelineEntries.length === 0 ? (
            <EmptyState
              emoji="📅"
              title="Нет задач со временем"
              description="Коснись таймлайна, чтобы запланировать задачу на конкретное время."
              actionLabel={unscheduledTasks.length > 0 ? 'Запланировать из «Мыслей»' : undefined}
              onAction={
                unscheduledTasks.length > 0
                  ? () =>
                      router.push({
                        pathname: '/task-form',
                        params: {
                          task: JSON.stringify(unscheduledTasks[0]),
                          selectedDate: selectedDate.toISOString(),
                          selectedDateKey,
                        },
                      })
                  : undefined
              }
            />
          ) : (
            <Timeline
              tasks={tasks}
              onToggle={(id) => toggleTask.mutate(id)}
              onOpenTask={openTask}
              onCreateAt={(instant) => openTimelineCapture({ instant, selectedDate, selectedDateKey })}
              shouldAutoScroll={isToday}
              currentDate={selectedDate}
              currentDateKey={selectedDateKey}
              profileTimezone={profileTimezone}
              currentTaskId={currentTask?.id}
            />
          )}
        </>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#6B5BFC' },
  todayButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#EDE9FE',
  },
  todayButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B5BFC',
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  navButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonText: {
    fontSize: 24,
    color: '#6B5BFC',
    fontWeight: '600',
  },
  headerDate: { fontSize: 16, color: '#111827', fontWeight: '500', textTransform: 'capitalize', flex: 1, textAlign: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText: { color: '#6B7280', textAlign: 'center' },
  unscheduledList: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  unscheduledItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  unscheduledDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  unscheduledText: { fontSize: 14, color: '#111827', flex: 1 },
  unscheduledTextDone: { textDecorationLine: 'line-through', color: '#9CA3AF' },
});
