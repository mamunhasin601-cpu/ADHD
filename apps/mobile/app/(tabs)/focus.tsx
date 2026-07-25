import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Экран "Фокус-комнаты" (body doubling) — Этап 2 по ТЗ. */
export default function FocusScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>🧑‍💻</Text>
        <Text style={styles.title}>Фокус-комнаты</Text>
        <Text style={styles.text}>
          Body doubling — работа в присутствии других.{'\n'}
          Функция появится во втором этапе разработки.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '600', color: '#111827', marginBottom: 8 },
  text: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
});
