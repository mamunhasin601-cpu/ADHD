import { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useInboxTasks, useToggleInboxTask } from '../../lib/api/tasks';
import type { Task } from '@focus/shared-types';

/**
 * Пользовательская зона «Мысли» — технически Inbox-задачи без времени.
 *
 * Назначение:
 * - Отображает задачи, перемещённые сюда через recovery (targetStartTime: null).
 * - Позволяет открыть задачу для редактирования / постановки времени.
 * - Не хранит данные в Zustand — только React Query.
 * - Пользовательская копия говорит «Мысли», а route/cache/API сохраняют inbox
 *   как совместимый технический контракт.
 * - После recovery Today, Inbox и recovery-список обновляются без перезапуска приложения.
 */
export default function InboxScreen() {
  const router = useRouter();
  const { data: tasks, isLoading, isError, refetch } = useInboxTasks();
  const toggleTask = useToggleInboxTask();

  const openTask = useCallback(
    (task: Task) => {
      router.push({
        pathname: '/task-form',
        params: {
          task: JSON.stringify(task),
          selectedDate: new Date().toISOString(),
        },
      });
    },
    [router],
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Мысли</Text>
        <Text style={styles.headerSubtitle}>Запиши, чтобы не держать в голове</Text>
      </View>

      {/* Loading */}
      {isLoading && (
        <View style={styles.centered} accessibilityLiveRegion="polite">
          <ActivityIndicator
            color="#6B5BFC"
            accessibilityLabel="Загрузка мыслей"
          />
        </View>
      )}

      {/* Error + Retry */}
      {isError && !isLoading && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>
            Не удалось загрузить мысли. Проверьте соединение.
          </Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => refetch()}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Повторить загрузку"
          >
            <Text style={styles.retryText}>Повторить</Text>
          </Pressable>
        </View>
      )}

      {/* Empty state */}
      {!isLoading && !isError && (tasks?.length ?? 0) === 0 && (
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>💭</Text>
          <Text style={styles.emptyTitle}>Здесь пока спокойно</Text>
          <Text style={styles.emptyText}>
            Записывай сюда то, что не хочется держать в голове.{'\n'}
            Планировать время можно позже.
          </Text>
        </View>
      )}

      {/* Task list */}
      {!isLoading && !isError && (tasks?.length ?? 0) > 0 && (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable
              style={styles.taskRow}
              onPress={() => openTask(item)}
              onLongPress={() => toggleTask.mutate(item.id)}
              accessible
              accessibilityRole="button"
              accessibilityLabel={
                item.completedAt
                  ? `Запись выполнена: ${item.title}. Долгое нажатие отменит отметку.`
                  : `Запись: ${item.title}. Нажмите для редактирования. Долгое нажатие отметит выполненной.`
              }
            >
              <View
                style={[
                  styles.taskDot,
                  { backgroundColor: item.completedAt ? '#E5E7EB' : item.color },
                ]}
              />
              <View style={styles.taskContent}>
                <Text
                  style={[
                    styles.taskTitle,
                    !!item.completedAt && styles.taskTitleDone,
                  ]}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
                {item.subTasks && item.subTasks.length > 0 && (
                  <Text style={styles.subtaskCount}>
                    {item.subTasks.length} подзадач
                  </Text>
                )}
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
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
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#6B5BFC',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorText: {
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 14,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#EDE9FE',
    borderRadius: 8,
  },
  retryText: {
    color: '#6B5BFC',
    fontWeight: '600',
    fontSize: 14,
  },

  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },

  listContent: { paddingVertical: 8 },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  taskDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  taskContent: { flex: 1 },
  taskTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
    lineHeight: 20,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  subtaskCount: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  chevron: {
    fontSize: 20,
    color: '#D1D5DB',
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 42,
  },
});
