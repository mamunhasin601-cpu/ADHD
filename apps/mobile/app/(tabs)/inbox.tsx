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
import { useOrbitsTheme } from '../../theme/orbits';

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
  const theme = useOrbitsTheme();
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
    <SafeAreaView testID="inbox-screen" style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style={theme.name === 'dark' ? 'light' : 'dark'} />

      {/* Header */}
      <View testID="inbox-header" style={[styles.header, { backgroundColor: theme.surfacePrimary, borderBottomColor: theme.borderSubtle }]}>
        <Text testID="inbox-header-title" style={[styles.headerTitle, { color: theme.brand }]}>Мысли</Text>
        <Text testID="inbox-header-subtitle" style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Запиши, чтобы не держать в голове</Text>
      </View>

      {/* Loading */}
      {isLoading && (
        <View style={styles.centered} accessibilityLiveRegion="polite">
          <ActivityIndicator
            testID="inbox-loading"
            color={theme.brand}
            accessibilityLabel="Загрузка мыслей"
          />
        </View>
      )}

      {/* Error + Retry */}
      {isError && !isLoading && (
        <View style={styles.centered}>
          <Text testID="inbox-error" style={[styles.errorText, { color: theme.errorPrimary }]}>
            Не удалось загрузить мысли. Проверьте соединение.
          </Text>
          <Pressable
            testID="inbox-retry"
            style={({ pressed }) => [
              styles.retryButton,
              { backgroundColor: pressed ? theme.brandPressed : theme.brand },
            ]}
            onPress={() => refetch()}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Повторить загрузку"
          >
            <Text style={[styles.retryText, { color: theme.retryText }]}>Повторить</Text>
          </Pressable>
        </View>
      )}

      {/* Empty state */}
      {!isLoading && !isError && (tasks?.length ?? 0) === 0 && (
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>💭</Text>
          <Text testID="inbox-empty-title" style={[styles.emptyTitle, { color: theme.textPrimary }]}>Здесь пока спокойно</Text>
          <Text testID="inbox-empty-text" style={[styles.emptyText, { color: theme.textSecondary }]}>
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
              testID={`inbox-task-${item.id}`}
              style={[
                styles.taskRow,
                { backgroundColor: item.completedAt ? theme.completionSoft : theme.surfacePrimary },
              ]}
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
                testID={`inbox-task-dot-${item.id}`}
                style={[
                  styles.taskDot,
                  { backgroundColor: item.completedAt ? theme.completionPrimary : item.color },
                ]}
              />
              <View style={styles.taskContent}>
                <Text
                  testID={`inbox-task-title-${item.id}`}
                  style={[
                    styles.taskTitle,
                    { color: item.completedAt ? theme.completionPrimary : theme.textPrimary },
                    !!item.completedAt && styles.taskTitleDone,
                  ]}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
                {item.subTasks && item.subTasks.length > 0 && (
                  <Text
                    testID={`inbox-task-subtasks-${item.id}`}
                    style={[styles.subtaskCount, { color: item.completedAt ? theme.completionPrimary : theme.textSecondary }]}
                  >
                    {item.subTasks.length} подзадач
                  </Text>
                )}
              </View>
              <Text testID={`inbox-task-chevron-${item.id}`} style={[styles.chevron, { color: theme.textSecondary }]}>›</Text>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View testID="inbox-divider" style={[styles.separator, { backgroundColor: theme.borderSubtle }]} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
  },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorText: {
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 14,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    fontWeight: '600',
    fontSize: 14,
  },

  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },

  listContent: { paddingVertical: 8 },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
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
    lineHeight: 20,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
  },
  subtaskCount: {
    fontSize: 12,
    marginTop: 2,
  },
  chevron: {
    fontSize: 20,
    fontWeight: '600',
  },
  separator: {
    height: 1,
    marginLeft: 42,
  },
});
