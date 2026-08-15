import { useState, useMemo, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
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
import { isFreeTierLimitError } from '../../lib/api-error';
import type { Task } from '@focus/shared-types';
import { formatClockTime } from '../../lib/time-format';
import { findCurrentTask } from '../../lib/current-task';
import { NotificationInvitation } from '../../components/NotificationInvitation';
import { WeekStrip } from '../../components/WeekStrip';
import { useNotificationLifecycle } from '../../lib/notification-lifecycle';
import {
  TASK_DURATION_PRESETS,
  type TaskDurationPreset,
  taskDurationLabel,
} from '../../lib/task-duration';

/**
 * Экран "Сегодня" — главный экран таймлайна дня.
 * Открывается сразу на "сейчас" (см. Timeline), а не на списке/меню — по UX-заметкам.
 */
export default function TodayScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
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

  const scheduledTasks = tasks.filter((task: Task) => task.startTime && !task.completedAt);
  const unscheduledTasks = tasks.filter((task: Task) => !task.startTime);

  // Прогресс дня: завершенные / все задачи
  const completedCount = tasks.filter((task: Task) => task.completedAt).length;
  const totalCount = tasks.length;

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

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddTime, setQuickAddTime] = useState<Date | null>(null);
  const [title, setTitle] = useState('');
  const [quickAddDuration, setQuickAddDuration] = useState<TaskDurationPreset>(null);
  const quickSubmissionPending = useRef(false);

  function openQuickAdd(startTime: Date | null) {
    // Если startTime передан, используем его как есть
    // Если null, то задача создается без времени
    setQuickAddTime(startTime);
    setTitle('');
    setQuickAddDuration(null);
    setQuickAddOpen(true);
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

  async function handleSubmitQuickAdd(startTime: Date | null = quickAddTime) {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || createTask.isPending || quickSubmissionPending.current) return;
    quickSubmissionPending.current = true;

    try {
      await createTask.mutateAsync({
        title: trimmedTitle,
        startTime: startTime ? startTime.toISOString() : null,
        durationMinutes: quickAddDuration,
      });

      // Force a fresh read after successful creation. This is intentionally
      // broader than the date-specific mutation invalidation so the Today
      // screen cannot remain on a stale cache after POST /tasks succeeds.
      await queryClient.refetchQueries({ queryKey: ['tasks'] });

      setQuickAddOpen(false);
      setTitle('');
      setQuickAddTime(null);
      setQuickAddDuration(null);
    } catch (err) {
      if (isFreeTierLimitError(err)) {
        setQuickAddOpen(false);
        router.push('/paywall');
      } else {
        Alert.alert(
          'Не удалось создать задачу',
          'Проверьте соединение и попробуйте снова',
        );
      }
    } finally {
      quickSubmissionPending.current = false;
    }
  }

  function openFullForm() {
    if (createTask.isPending) return;
    const trimmedTitle = title.trim();
    setQuickAddOpen(false);
    router.push({
      pathname: '/task-form',
      params: {
        ...(trimmedTitle ? { prefillTitle: trimmedTitle } : {}),
        ...(quickAddTime ? { prefillStartTime: quickAddTime.toISOString() } : {}),
        ...(quickAddDuration !== null
          ? { prefillDurationMinutes: String(quickAddDuration) }
          : {}),
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

      {!isLoading && !isError && totalCount === 0 && (
        <EmptyState
          emoji="🌅"
          title={isToday ? "Начни свой день" : "Свободный день"}
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

      {!isLoading && !isError && totalCount > 0 && (
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
                startError?.taskId === (currentTask ?? nextTask!).id &&
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
          {scheduledTasks.length === 0 ? (
            <EmptyState
              emoji="📅"
              title="Таймлайн свободен"
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
              onCreateAt={(startTime) => openQuickAdd(startTime)}
              shouldAutoScroll={isToday}
              currentDate={selectedDate}
              currentDateKey={selectedDateKey}
              profileTimezone={profileTimezone}
              currentTaskId={currentTask?.id}
            />
          )}
        </>
      )}

      <Pressable
        style={styles.fab}
        onPress={() => openQuickAdd(null)}
        accessibilityRole="button"
        accessibilityLabel="Быстро добавить задачу"
      >
        <Text style={styles.fabText}>＋</Text>
      </Pressable>

      <Modal
        visible={quickAddOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setQuickAddOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Новая задача</Text>
            <TextInput
              style={styles.input}
              placeholder="Название"
              placeholderTextColor="#9CA3AF"
              value={title}
              onChangeText={setTitle}
              autoFocus
              onSubmitEditing={() => handleSubmitQuickAdd()}
              returnKeyType="done"
              accessibilityLabel="Название задачи"
            />
            <Text style={styles.timeHint}>
              {quickAddTime
                ? `Выбранное время: ${formatClockTime(quickAddTime, timeFormat)}`
                : 'Без времени — запись сохранится в «Мысли»'}
            </Text>
            <Text style={styles.durationLabel}>Примерная длительность</Text>
            <View style={styles.durationPresets}>
              {TASK_DURATION_PRESETS.map((duration) => (
                <Pressable
                  key={duration ?? 'unknown'}
                  onPress={() => setQuickAddDuration(duration)}
                  accessibilityRole="button"
                  accessibilityLabel={`Длительность ${taskDurationLabel(duration)}`}
                  accessibilityState={{ selected: quickAddDuration === duration }}
                  style={[
                    styles.durationChip,
                    quickAddDuration === duration && styles.durationChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.durationChipText,
                      quickAddDuration === duration && styles.durationChipTextActive,
                    ]}
                  >
                    {taskDurationLabel(duration)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setQuickAddOpen(false)}
                style={styles.modalCancel}
                accessibilityRole="button"
                accessibilityLabel="Отменить быстрое добавление"
              >
                <Text style={styles.modalCancelText}>Отмена</Text>
              </Pressable>
              <Pressable
                onPress={openFullForm}
                style={styles.modalMore}
                accessibilityRole="button"
                accessibilityLabel="Открыть полную форму задачи"
                accessibilityState={{ disabled: createTask.isPending }}
                disabled={createTask.isPending}
              >
                <Text style={styles.modalMoreText}>Подробнее →</Text>
              </Pressable>
              {quickAddTime && (
                <Pressable
                  onPress={() => handleSubmitQuickAdd(null)}
                  style={[styles.modalThoughts, createTask.isPending && styles.modalActionDisabled]}
                  accessibilityRole="button"
                  accessibilityLabel="Сохранить задачу в Мысли без времени"
                  accessibilityState={{ disabled: !title.trim() || createTask.isPending }}
                  disabled={!title.trim() || createTask.isPending}
                >
                  <Text style={styles.modalThoughtsText}>В Мысли</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => handleSubmitQuickAdd()}
                style={[styles.modalSubmit, (!title.trim() || createTask.isPending) && styles.modalActionDisabled]}
                accessibilityRole="button"
                accessibilityLabel={
                  quickAddTime
                    ? `Добавить задачу на ${formatClockTime(quickAddTime, timeFormat)}`
                    : 'Сохранить задачу в Мысли'
                }
                accessibilityState={{ disabled: !title.trim() || createTask.isPending }}
                disabled={!title.trim() || createTask.isPending}
              >
                <Text style={styles.modalSubmitText}>
                  {quickAddTime
                    ? `Добавить на ${formatClockTime(quickAddTime, timeFormat)}`
                    : 'Сохранить в Мысли'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6B5BFC',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#6B5BFC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabText: { fontSize: 28, color: '#FFFFFF', lineHeight: 32 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  timeHint: { fontSize: 13, color: '#6B7280', marginTop: 8 },
  durationLabel: { fontSize: 13, color: '#6B7280', marginTop: 16, marginBottom: 8 },
  durationPresets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  durationChip: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  durationChipActive: { backgroundColor: '#6B5BFC', borderColor: '#6B5BFC' },
  durationChipText: { color: '#4B5563', fontSize: 13 },
  durationChipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },
  modalCancel: { paddingVertical: 10, paddingHorizontal: 12 },
  modalCancelText: { color: '#6B7280', fontSize: 15 },
  modalMore: { paddingVertical: 10, paddingHorizontal: 12 },
  modalMoreText: { color: '#6B5BFC', fontSize: 15, fontWeight: '600' },
  modalThoughts: { paddingVertical: 10, paddingHorizontal: 12 },
  modalThoughtsText: { color: '#6B5BFC', fontSize: 15, fontWeight: '600' },
  modalSubmit: { backgroundColor: '#6B5BFC', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  modalSubmitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  modalActionDisabled: { opacity: 0.45 },
});
