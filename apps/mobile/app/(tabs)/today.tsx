import { useState } from 'react';
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
import { Timeline } from '../../components/timeline/Timeline';
import { useTasksForDate, useCreateTask, useToggleTask } from '../../lib/api/tasks';
import type { Task } from '@focus/shared-types';

/**
 * Экран "Сегодня" — главный экран таймлайна дня.
 * Открывается сразу на "сейчас" (см. Timeline), а не на списке/меню — по UX-заметкам.
 */
export default function TodayScreen() {
  const today = new Date();
  const todayLabel = today.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const { data: tasks = [], isLoading, isError } = useTasksForDate(today);
  const createTask = useCreateTask(today);
  const toggleTask = useToggleTask(today);

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddTime, setQuickAddTime] = useState<Date | null>(null);
  const [title, setTitle] = useState('');

  function openQuickAdd(startTime: Date | null) {
    setQuickAddTime(startTime);
    setTitle('');
    setQuickAddOpen(true);
  }

  function handleSubmitQuickAdd() {
    if (!title.trim()) return; // единственное обязательное поле — само название

    createTask.mutate(
      {
        title: title.trim(),
        startTime: quickAddTime ? quickAddTime.toISOString() : null,
      },
      {
        onError: () =>
          Alert.alert('Не удалось создать задачу', 'Проверьте соединение и попробуйте снова'),
      },
    );
    setQuickAddOpen(false);
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Focus</Text>
        <Text style={styles.headerDate}>{todayLabel}</Text>
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

      {!isLoading && !isError && (
        <Timeline
          tasks={tasks}
          onToggle={(id) => toggleTask.mutate(id)}
          onOpenTask={(task: Task) => {
            // TODO: полноценный экран редактирования — следующий шаг роадмапа
            Alert.alert(task.title, 'Редактирование задач появится на следующем шаге разработки');
          }}
          onCreateAt={(startTime) => openQuickAdd(startTime)}
        />
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
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#6B5BFC' },
  headerDate: { fontSize: 14, color: '#6B7280', marginTop: 2, textTransform: 'capitalize' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText: { color: '#6B7280', textAlign: 'center' },
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
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20, gap: 12 },
  modalCancel: { paddingVertical: 10, paddingHorizontal: 16 },
  modalCancelText: { color: '#6B7280', fontSize: 15 },
  modalSubmit: { backgroundColor: '#6B5BFC', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  modalSubmitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
