import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useOrbitsTheme } from '../../theme/orbits';

/** Экран "Фокус-комнаты" (body doubling) — Этап 2 по ТЗ. */
export default function FocusScreen() {
  const theme = useOrbitsTheme();
  return (
    <SafeAreaView testID="focus-screen" style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style={theme.name === 'dark' ? 'light' : 'dark'} />
      <View style={styles.content}>
        <Text style={styles.emoji}>🧑‍💻</Text>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Фокус-комнаты</Text>
        <Text style={[styles.text, { color: theme.textSecondary }]}>
          Body doubling — работа в присутствии других.{'\n'}
          Функция появится во втором этапе разработки.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  text: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
