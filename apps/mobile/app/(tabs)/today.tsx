import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { Timeline } from '../../components/timeline/Timeline';
import { NowCard } from '../../components/NowCard';
import { EmptyState } from '../../components/EmptyState';
import {
  useTasksForDate,
  useCreateTask,
  useToggleTask,
  useStartTask,
  useUpdateTask,
  useDeleteTask,
  getActiveTaskConflict,
  getEarlyStartConflict,
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
import { TodayHeader } from '../../components/today/TodayHeader';
import { useGlobalCapture } from '../../components/GlobalCapture';
import { useOrbitsTheme } from '../../theme/orbits';
import { useNotificationLifecycle } from '../../lib/notification-lifecycle';
import { isTaskRecord } from '../../lib/task-kind';
import { FocusDatePicker } from '../../components/today/FocusDatePicker';
import { useMinuteWallClock } from '../../lib/use-minute-wall-clock';
import { FocusDialog } from '../../components/FocusDialog';
import {
  formatTaskActionSchedule,
  isFutureUnstartedTask,
} from '../../lib/task-action-confirmation';

/**
 * Экран "Сегодня" — главный экран таймлайна дня.
 * Открывается сразу на "сейчас" (см. Timeline), а не на списке/меню — по UX-заметкам.
 */
export default function TodayScreen() {
  const router = useRouter();
  const { setGlobalCaptureDateContext } = useGlobalCapture();
  const theme = useOrbitsTheme();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  // Raw profile IANA timezone. May be undefined before the profile loads or
  // invalid if the stored value is corrupt. Never substituted with UTC for
  // Recovery — RecoverySection owns that guard (Task 0006C/0007A).
  const profileTimezone = useAuthStore((s) => s.user?.timezone);
  const timeFormat = useAuthStore((s) => s.user?.timeFormat ?? 'SYSTEM');
  const { nowMs, resync: resyncClock } = useMinuteWallClock(profileTimezone);
  const currentTime = useMemo(() => new Date(nowMs), [nowMs]);
  useFocusEffect(useCallback(() => {
    resyncClock();
  }, [resyncClock]));
  const hasCompletedOnboarding = useAuthStore((s) => Boolean(s.user?.hasCompletedOnboarding));
  const notificationLifecycle = useNotificationLifecycle();

  // isToday for the non-Recovery parts of Today (progress ring, Now/Next,
  // timeline autoscroll). Both sides go through the canonical date helper, so
  // the comparison uses the profile timezone when it is valid and the DEVICE
  // calendar day otherwise — never UTC (Task 0007A).
  const isToday = useMemo(
    () =>
      toCanonicalDateParam(selectedDate, profileTimezone) ===
      toCanonicalDateParam(currentTime, profileTimezone),
    [selectedDate, currentTime, profileTimezone],
  );

  const selectedDateKey = toCanonicalDateParam(selectedDate, profileTimezone);
  const todayDateKey = toCanonicalDateParam(currentTime, profileTimezone);

  useEffect(() => {
    setGlobalCaptureDateContext({ selectedDate, selectedDateKey });
  }, [selectedDate, selectedDateKey, setGlobalCaptureDateContext]);

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
    refetch,
    isRefetching,
  } = useTasksForDate(selectedDate, profileTimezone);

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
    return findCurrentTask(tasks, currentTime, dayEnd);
  }, [tasks, currentTime, isToday, profileTimezone]);

  // Следующая задача: startTime > now, ближайшая
  const nextTask = useMemo(() => {
    if (!isToday) return null;
    const now = currentTime.getTime();
    const upcoming = scheduledTasks
      .filter((task: Task) => new Date(task.startTime!).getTime() > now)
      .sort((a: Task, b: Task) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime());
    return upcoming[0] || null;
  }, [scheduledTasks, currentTime, isToday]);
  const focusedTask = currentTask ?? nextTask;
  // Same canonical key as the Today query and Recovery invalidation (0007A).
  const createTask = useCreateTask(selectedDate, profileTimezone);
  const toggleTask = useToggleTask(selectedDate, profileTimezone);
  const startTask = useStartTask(selectedDate, profileTimezone);
  const updateTask = useUpdateTask(selectedDate, profileTimezone);
  const deleteTask = useDeleteTask(selectedDate, profileTimezone);
  const startSubmissionPending = useRef(false);
  const switchSubmissionPending = useRef(false);
  const [switchPending, setSwitchPending] = useState(false);
  const [startConflict, setStartConflict] = useState<{
    taskId: string;
    activeTaskId: string;
    activeTitle: string;
    confirmEarlyStart: boolean;
  } | null>(null);
  const earlyStartSubmissionPending = useRef(false);
  const [earlyStartPending, setEarlyStartPending] = useState(false);
  const [earlyStartConfirmation, setEarlyStartConfirmation] = useState<{
    taskId: string;
    title: string;
    startTime: Date | string;
  } | null>(null);
  const futureCompletionSubmissionPending = useRef(false);
  const [futureCompletionPending, setFutureCompletionPending] = useState(false);
  const [futureCompletionError, setFutureCompletionError] = useState<string | null>(null);
  const [futureCompletionConfirmation, setFutureCompletionConfirmation] = useState<{
    taskId: string;
    title: string;
    startTime: Date | string;
  } | null>(null);
  const [startError, setStartError] = useState<{
    taskId: string;
    dateKey: string;
    message: string;
  } | null>(null);

  async function submitStart(taskId: string, confirmEarlyStart = false) {
    if (startSubmissionPending.current || startTask.isPending) return;
    startSubmissionPending.current = true;
    setStartError(null);
    try {
      await startTask.mutateAsync(confirmEarlyStart ? { id: taskId, confirmEarlyStart: true } : taskId);
      setEarlyStartConfirmation(null);
    } catch (error) {
      const earlyConflict = getEarlyStartConflict(error);
      if (earlyConflict) {
        setStartConflict(null);
        setEarlyStartConfirmation({
          taskId: earlyConflict.scheduledTask.id,
          title: earlyConflict.scheduledTask.title,
          startTime: earlyConflict.scheduledTask.startTime!,
        });
        return;
      }
      const conflict = getActiveTaskConflict(error);
      if (conflict) {
        setEarlyStartConfirmation(null);
        setStartConflict({
          taskId,
          activeTaskId: conflict.activeTask.id,
          activeTitle: conflict.activeTask.title,
          confirmEarlyStart,
        });
        return;
      }
      setStartError({
        taskId,
        dateKey: toCanonicalDateParam(selectedDate, profileTimezone),
        message: 'Не удалось начать задачу. Проверьте соединение и попробуйте снова.',
      });
    } finally {
      startSubmissionPending.current = false;
    }
  }

  async function handleStart(taskId: string) {
    const task = tasks.find((candidate: Task) => candidate.id === taskId);
    if (task && isFutureUnstartedTask(task, nowMs)) {
      setStartError(null);
      setEarlyStartConfirmation({ taskId, title: task.title, startTime: task.startTime! });
      return;
    }
    await submitStart(taskId);
  }

  async function confirmEarlyTaskStart() {
    if (!earlyStartConfirmation || earlyStartSubmissionPending.current || startTask.isPending) return;
    earlyStartSubmissionPending.current = true;
    setEarlyStartPending(true);
    try {
      await submitStart(earlyStartConfirmation.taskId, true);
    } finally {
      earlyStartSubmissionPending.current = false;
      setEarlyStartPending(false);
    }
  }

  async function confirmTaskSwitch() {
    if (!startConflict || switchSubmissionPending.current || startTask.isPending) return;
    const { taskId, activeTaskId, confirmEarlyStart } = startConflict;
    switchSubmissionPending.current = true;
    setSwitchPending(true);
    setStartError(null);
    try {
      await startTask.mutateAsync({
        id: taskId,
        activeTaskId,
        confirmSwitch: true,
        ...(confirmEarlyStart ? { confirmEarlyStart: true } : {}),
      });
      setStartConflict(null);
    } catch {
      setStartConflict(null);
      setStartError({
        taskId,
        dateKey: toCanonicalDateParam(selectedDate, profileTimezone),
        message: 'Не удалось переключить задачу. Обновите день и попробуйте снова.',
      });
    } finally {
      switchSubmissionPending.current = false;
      setSwitchPending(false);
    }
  }

  function handleToggle(taskId: string) {
    const task = tasks.find((candidate: Task) => candidate.id === taskId);
    if (task && isFutureUnstartedTask(task, nowMs)) {
      setFutureCompletionError(null);
      setFutureCompletionConfirmation({ taskId, title: task.title, startTime: task.startTime! });
      return;
    }
    toggleTask.mutate(taskId);
  }

  async function confirmFutureCompletion() {
    if (!futureCompletionConfirmation || futureCompletionSubmissionPending.current || toggleTask.isPending) return;
    futureCompletionSubmissionPending.current = true;
    setFutureCompletionPending(true);
    setFutureCompletionError(null);
    try {
      await toggleTask.mutateAsync({ id: futureCompletionConfirmation.taskId, optimistic: false });
      setFutureCompletionConfirmation(null);
    } catch {
      setFutureCompletionError('Не удалось отметить задачу выполненной. Попробуйте снова.');
    } finally {
      futureCompletionSubmissionPending.current = false;
      setFutureCompletionPending(false);
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
    <SafeAreaView testID="today-screen" style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style={theme.name === 'dark' ? 'light' : 'dark'} />
      <TodayHeader
        isToday={isToday}
        now={currentTime}
        profileTimezone={profileTimezone}
        dateLabel={dateLabel}
        selectedDateKey={selectedDateKey}
        todayDateKey={todayDateKey}
        progressKnown={!isLoading && !isError}
        completed={completedCount}
        total={totalCount}
        canGoPrevious
        onPreviousWeek={() => selectCalendarDay(addCalendarDays(selectedDateKey, -7))}
        onNextWeek={() => selectCalendarDay(addCalendarDays(selectedDateKey, 7))}
        onSelectDate={selectCalendarDay}
        onOpenDatePicker={() => setDatePickerVisible(true)}
      />

      <FocusDatePicker
        visible={datePickerVisible}
        selectedDate={selectedDateKey}
        todayDate={todayDateKey}
        onClose={() => setDatePickerVisible(false)}
        onConfirm={(date) => {
          setDatePickerVisible(false);
          selectCalendarDay(date);
        }}
      />

      <ScrollView
        testID="today-content-scroll"
        style={styles.contentScroll}
        contentContainerStyle={styles.scrollContent}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
      {isLoading && (
        <View style={styles.centered} accessible accessibilityLabel="Загружаем ваш день">
          <ActivityIndicator color={theme.brand} />
          <Text style={[styles.stateText, { color: theme.textSecondary }]}>Загружаем ваш день…</Text>
        </View>
      )}

      {isError && (
        <View
          style={[styles.errorContainer, { backgroundColor: theme.errorSoft }]}
          accessibilityLabel="Не удалось загрузить ваш день"
        >
          <Text style={[styles.errorText, { color: theme.errorPrimary }]}>Не удалось загрузить ваш день.</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Повторить загрузку"
            accessibilityState={{ disabled: Boolean(isRefetching), busy: Boolean(isRefetching) }}
            disabled={isRefetching}
            onPress={() => {
              if (!isRefetching) void refetch();
            }}
            style={[
              styles.retry,
              { backgroundColor: theme.brandPressed },
              isRefetching && styles.retryDisabled,
            ]}
          >
            <Text style={[styles.retryText, { color: theme.retryText }]}>
              {isRefetching ? 'Загружаем…' : 'Повторить'}
            </Text>
          </Pressable>
        </View>
      )}

      {!isLoading && !isError && !hasPlanEntries && (
        <EmptyState
          orbits
          title={isToday ? "День пока свободен" : "На этот день пока нет задач"}
          description={
            isToday
              ? "Можно начать с одного небольшого шага. Нажмите + внизу или коснитесь таймлайна."
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

      {!isLoading && !isError && hasPlanEntries && (
        <>
          {isToday && focusedTask && hasCompletedOnboarding && notificationLifecycle.permission === 'not-asked' && notificationLifecycle.invitation === 'available' && (
            <NotificationInvitation />
          )}
          {unscheduledTasks.length > 0 && (
            <View style={[styles.unscheduledList, { borderBottomColor: theme.borderSubtle, backgroundColor: theme.background }]}>
              {unscheduledTasks.map((task: Task) => (
                <Pressable
                  key={task.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: Boolean(task.completedAt) }}
                  accessibilityLabel={`${task.title}${task.completedAt ? ', Выполнено' : ''}`}
                  accessibilityHint="Нажмите, чтобы изменить выполнение. Удерживайте, чтобы открыть задачу"
                  style={[styles.unscheduledItem, { backgroundColor: task.completedAt ? theme.completionSoft : theme.surfacePrimary, borderColor: task.completedAt ? theme.completionPrimary : theme.borderSubtle }]}
                  onPress={() => handleToggle(task.id)}
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
                      { backgroundColor: task.completedAt ? theme.completionPrimary : theme.brand },
                    ]}
                  />
                  {!!task.completedAt && <Text style={{ color: theme.completionPrimary, fontWeight: '700', marginRight: 6 }}>✓ Готово</Text>}
                  <Text
                    style={[
                      styles.unscheduledText,
                      { color: theme.textPrimary },
                      !!task.completedAt && styles.unscheduledTextDone,
                    ]}
                  >
                    {task.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          {timelineEntries.length === 0 ? (
            <EmptyState
              orbits
              emoji="📅"
              title="Нет задач со временем"
              description="Коснись таймлайна, чтобы создать задачу. Время можно выбрать в форме."
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
              nowMs={nowMs}
              tasks={tasks}
              onToggle={handleToggle}
              onOpenTask={openTask}
              onMoveToThoughts={async (task) => {
                await updateTask.mutateAsync({ id: task.id, dto: { startTime: null } });
              }}
              onDeleteTask={async (task) => {
                await deleteTask.mutateAsync(task.id);
              }}
              onCreateTask={() => router.push({
                pathname: '/task-form',
                params: { selectedDate: selectedDate.toISOString(), selectedDateKey, prefillKind: 'TASK' },
              })}
              shouldAutoScroll={isToday}
              profileTimezone={profileTimezone}
              currentTaskId={currentTask?.id}
              focusedTaskId={isToday ? focusedTask?.id : undefined}
              renderFocusedTask={isToday && focusedTask ? (task, onShowActions) => (
                <NowCard
                  task={task}
                  mode={task.id === currentTask?.id ? 'current' : 'upcoming'}
                  embeddedInTimeline
                  onComplete={handleToggle}
                  onStart={handleStart}
                  onOpenTask={openTask}
                  onShowActions={onShowActions}
                  onSaveFirstStep={async (taskId, firstStep) => updateTask.mutateAsync({ id: taskId, dto: { firstStep } })}
                  isCompleting={toggleTask.isPending}
                  isStarting={startTask.isPending}
                  isSavingFirstStep={updateTask.isPending}
                  startError={
                    startError &&
                    startError.taskId === task.id &&
                    startError.dateKey === toCanonicalDateParam(selectedDate, profileTimezone)
                      ? startError.message
                      : null
                  }
                />
              ) : undefined}
            />
          )}
        </>
      )}
      </ScrollView>

      <FocusDialog
        visible={startConflict !== null}
        title={startConflict ? `Сейчас выполняется «${startConflict.activeTitle}». Переключиться?` : ''}
        onDismiss={() => {
          if (!switchPending) setStartConflict(null);
        }}
        actions={[
          {
            text: 'Остаться',
            style: 'cancel',
            disabled: switchPending,
            dismissOnPress: false,
            onPress: () => setStartConflict(null),
          },
          {
            text: switchPending ? 'Переключаем…' : 'Переключиться',
            disabled: switchPending,
            busy: switchPending,
            dismissOnPress: false,
            onPress: confirmTaskSwitch,
          },
        ]}
      />

      <FocusDialog
        visible={earlyStartConfirmation !== null}
        title={earlyStartConfirmation
          ? `Задача запланирована на ${formatTaskActionSchedule(earlyStartConfirmation.startTime, nowMs, timeFormat, profileTimezone)}. Начать сейчас?`
          : ''}
        onDismiss={() => {
          if (!earlyStartPending) setEarlyStartConfirmation(null);
        }}
        actions={[
          {
            text: 'Отмена',
            style: 'cancel',
            disabled: earlyStartPending,
            dismissOnPress: false,
            onPress: () => setEarlyStartConfirmation(null),
          },
          {
            text: earlyStartPending ? 'Начинаем…' : 'Начать сейчас',
            disabled: earlyStartPending,
            busy: earlyStartPending,
            dismissOnPress: false,
            onPress: confirmEarlyTaskStart,
          },
        ]}
      />

      <FocusDialog
        visible={futureCompletionConfirmation !== null}
        title={futureCompletionConfirmation
          ? `Задача запланирована на ${formatTaskActionSchedule(futureCompletionConfirmation.startTime, nowMs, timeFormat, profileTimezone)}. Отметить выполненной сейчас?`
          : ''}
        message={futureCompletionError ?? undefined}
        onDismiss={() => {
          if (!futureCompletionPending) {
            setFutureCompletionConfirmation(null);
            setFutureCompletionError(null);
          }
        }}
        actions={[
          {
            text: 'Отмена',
            style: 'cancel',
            disabled: futureCompletionPending,
            dismissOnPress: false,
            onPress: () => {
              setFutureCompletionConfirmation(null);
              setFutureCompletionError(null);
            },
          },
          {
            text: futureCompletionPending ? 'Сохраняем…' : 'Выполнено',
            disabled: futureCompletionPending,
            busy: futureCompletionPending,
            dismissOnPress: false,
            onPress: confirmFutureCompletion,
          },
        ]}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentScroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  errorContainer: {
    margin: 24,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    gap: 12,
  },
  stateText: { fontSize: 15 },
  retry: { minHeight: 44, paddingHorizontal: 20, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  retryDisabled: { opacity: 0.6 },
  retryText: { fontWeight: '700' },
  errorText: { textAlign: 'center' },
  unscheduledList: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  unscheduledItem: { flexDirection: 'row', alignItems: 'center', padding: 12, minHeight: 48, borderWidth: 1, borderRadius: 12, marginVertical: 4 },
  unscheduledDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  unscheduledText: { fontSize: 14, flex: 1 },
  unscheduledTextDone: { textDecorationLine: 'line-through' },
});
