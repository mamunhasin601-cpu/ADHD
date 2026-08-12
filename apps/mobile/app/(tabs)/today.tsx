import { useState, useMemo, useEffect } from 'react';
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
import { ProgressRing } from '../../components/ProgressRing';
import { EmptyState } from '../../components/EmptyState';
import { RecoverySection } from '../../components/RecoverySection';
import {
  useTasksForDate,
  useCreateTask,
  useToggleTask,
} from '../../lib/api/tasks';
import { useAuthStore } from '../../stores/auth.store';
import { toCanonicalDateParam } from '../../lib/timezone';
import { isFreeTierLimitError } from '../../lib/api-error';
import type { Task } from '@focus/shared-types';

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

  const dateLabel = selectedDate.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
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

  // Текущая задача: startTime <= now < endTime
  const currentTask = useMemo(() => {
    if (!isToday) return null;
    const now = currentTime.getTime();
    return scheduledTasks.find((task: Task) => {
      const start = new Date(task.startTime!).getTime();
      const end = task.durationMinutes
        ? start + task.durationMinutes * 60 * 1000
        : start + 60 * 60 * 1000; // default 1 hour if no duration
      return start <= now && now < end;
    });
  }, [scheduledTasks, currentTime, isToday]);

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

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddTime, setQuickAddTime] = useState<Date | null>(null);
  const [title, setTitle] = useState('');

  function openQuickAdd(startTime: Date | null) {
    // Если startTime передан, используем его как есть
    // Если null, то задача создается без времени
    setQuickAddTime(startTime);
    setTitle('');
    setQuickAddOpen(true);
  }

  async function handleSubmitQuickAdd() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || createTask.isPending) return;

    try {
      await createTask.mutateAsync({
        title: trimmedTitle,
        startTime: quickAddTime ? quickAddTime.toISOString() : null,
      });

      // Force a fresh read after successful creation. This is intentionally
      // broader than the date-specific mutation invalidation so the Today
      // screen cannot remain on a stale cache after POST /tasks succeeds.
      await queryClient.refetchQueries({ queryKey: ['tasks'] });

      setQuickAddOpen(false);
      setTitle('');
      setQuickAddTime(null);
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
    }
  }

  function openFullForm() {
    setQuickAddOpen(false);
    router.push({
      pathname: '/task-form',
      params: {
        ...(title.trim() ? { prefillTitle: title.trim() } : {}),
        ...(quickAddTime ? { prefillStartTime: quickAddTime.toISOString() } : {}),
        selectedDate: selectedDate.toISOString(),
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
              onPress={() => setSelectedDate(new Date())}
              style={styles.todayButton}
            >
              <Text style={styles.todayButtonText}>Сегодня</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.dateNav}>
          <Pressable
            onPress={() => {
              const prev = new Date(selectedDate);
              prev.setDate(prev.getDate() - 1);
              setSelectedDate(prev);
            }}
            style={styles.navButton}
          >
            <Text style={styles.navButtonText}>‹</Text>
          </Pressable>
          <Text style={styles.headerDate}>{dateLabel}</Text>
          <Pressable
            onPress={() => {
              const next = new Date(selectedDate);
              next.setDate(next.getDate() + 1);
              setSelectedDate(next);
            }}
            style={styles.navButton}
          >
            <Text style={styles.navButtonText}>›</Text>
          </Pressable>
        </View>
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
              params: { selectedDate: selectedDate.toISOString() },
            })
          }
        />
      )}

      {/* Recovery — production coordinator owns timezone guard, query,
          mutation, banner lifecycle and the Today-level partial notice. */}
      <RecoverySection
        selectedDate={selectedDate}
        profileTimezone={profileTimezone}
        onTimezoneInvalid={() => router.push('/settings')}
      />

      {!isLoading && !isError && totalCount > 0 && (
        <>
          {isToday && (currentTask || nextTask) && (
            <View style={styles.nowNextCard}>
              {currentTask && (
                <View style={styles.nowSection}>
                  <Text style={styles.nowLabel}>Сейчас</Text>
                  <Text style={styles.nowTaskTitle} numberOfLines={1}>
                    {currentTask.title}
                  </Text>
                  {currentTask.durationMinutes && (
                    <Text style={styles.nowTaskTime}>
                      {new Date(currentTask.startTime!).toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      • {currentTask.durationMinutes} мин
                    </Text>
                  )}
                </View>
              )}
              {nextTask && (
                <View style={styles.nextSection}>
                  <Text style={styles.nextLabel}>Дальше</Text>
                  <Text style={styles.nextTaskTitle} numberOfLines={1}>
                    {nextTask.title}
                  </Text>
                  <Text style={styles.nextTaskTime}>
                    {new Date(nextTask.startTime!).toLocaleTimeString('ru-RU', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              )}
            </View>
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
              actionLabel={unscheduledTasks.length > 0 ? "Запланировать из Inbox" : undefined}
              onAction={
                unscheduledTasks.length > 0
                  ? () =>
                      router.push({
                        pathname: '/task-form',
                        params: {
                          task: JSON.stringify(unscheduledTasks[0]),
                          selectedDate: selectedDate.toISOString(),
                        },
                      })
                  : undefined
              }
            />
          ) : (
            <Timeline
              tasks={tasks}
              onToggle={(id) => toggleTask.mutate(id)}
              onOpenTask={(task: Task) => {
                router.push({
                  pathname: '/task-form',
                  params: {
                    task: JSON.stringify(task),
                    selectedDate: selectedDate.toISOString(),
                  },
                });
              }}
              onCreateAt={(startTime) => openQuickAdd(startTime)}
              shouldAutoScroll={isToday}
              currentDate={selectedDate}
              currentTaskId={currentTask?.id}
            />
          )}
        </>
      )}

      <Pressable style={styles.fab} onPress={() => openQuickAdd(null)}>
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
              onSubmitEditing={handleSubmitQuickAdd}
              returnKeyType="done"
            />
            <Text style={styles.timeHint}>
              {quickAddTime
                ? `Время: ${quickAddTime.toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })} (можно доразметить позже)`
                : 'Без времени — разметите позже'}
            </Text>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setQuickAddOpen(false)} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>Отмена</Text>
              </Pressable>
              <Pressable onPress={openFullForm} style={styles.modalMore}>
                <Text style={styles.modalMoreText}>Подробнее →</Text>
              </Pressable>
              <Pressable onPress={handleSubmitQuickAdd} style={styles.modalSubmit}>
                <Text style={styles.modalSubmitText}>Создать</Text>
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
  nowNextCard: {
    marginHorizontal: 20,
    marginVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  nowSection: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  nowLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B5BFC',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  nowTaskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  nowTaskTime: {
    fontSize: 13,
    color: '#6B7280',
  },
  nextSection: {},
  nextLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  nextTaskTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 2,
  },
  nextTaskTime: {
    fontSize: 13,
    color: '#9CA3AF',
  },
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
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },
  modalCancel: { paddingVertical: 10, paddingHorizontal: 12 },
  modalCancelText: { color: '#6B7280', fontSize: 15 },
  modalMore: { paddingVertical: 10, paddingHorizontal: 12 },
  modalMoreText: { color: '#6B5BFC', fontSize: 15, fontWeight: '600' },
  modalSubmit: { backgroundColor: '#6B5BFC', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  modalSubmitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
