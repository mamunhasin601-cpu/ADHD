import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

/**
 * Экран "Сегодня" — главный экран таймлайна дня.
 * TODO (Этап 1): реализовать вертикальный таймлайн с задачами.
 * Сейчас — заглушка для проверки запуска приложения.
 */
export default function TodayScreen() {
  const today = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Focus</Text>
        <Text style={styles.headerDate}>{today}</Text>
      </View>

      <ScrollView style={styles.timeline} showsVerticalScrollIndicator={false}>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderEmoji}>🚧</Text>
          <Text style={styles.placeholderTitle}>Таймлайн дня</Text>
          <Text style={styles.placeholderText}>
            Здесь будет вертикальная шкала времени от подъёма до сна.{'\n'}
            Backend API работает — добавь первую задачу!
          </Text>
        </View>
      </ScrollView>

      <Pressable style={styles.fab}>
        <Text style={styles.fabText}>＋</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
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
  },
  headerDate: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  timeline: {
    flex: 1,
    paddingHorizontal: 20,
  },
  placeholder: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  placeholderEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
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
  fabText: {
    fontSize: 28,
    color: '#FFFFFF',
    lineHeight: 32,
  },
});
