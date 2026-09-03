import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useInboxTasks } from '../../lib/api/tasks';
import { useOrbitsTheme } from '../../theme/orbits';

function thoughtCountLabel(count: number): string {
  const remainder100 = count % 100;
  const remainder10 = count % 10;
  if (remainder100 >= 11 && remainder100 <= 14) return `${count} мыслей`;
  if (remainder10 === 1) return `${count} мысль`;
  if (remainder10 >= 2 && remainder10 <= 4) return `${count} мысли`;
  return `${count} мыслей`;
}

export default function PlanScreen() {
  const theme = useOrbitsTheme();
  const router = useRouter();
  const { data: thoughts = [], isLoading, isError, refetch } = useInboxTasks();

  const status = isLoading
    ? 'Загружаем мысли…'
    : isError
      ? 'Не удалось загрузить мысли'
      : thoughts.length === 0
        ? 'Пока нет мыслей'
        : thoughtCountLabel(thoughts.length);

  return (
    <SafeAreaView testID="plan-preview-screen" style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style={theme.name === 'dark' ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.eyebrow, { color: theme.activeBorder }]}>Орбита дня</Text>
        <Text style={[styles.title, { color: theme.textPrimary }]}>План</Text>
        <Text style={[styles.copy, { color: theme.textSecondary }]}>
          Здесь собираем мысли и постепенно превращаем их в посильный план.
        </Text>

        <Pressable
          testID="plan-thoughts-open"
          accessibilityRole="button"
          accessibilityLabel={`Мысли. ${status}. Открыть`}
          accessibilityHint="Показать все мысли"
          onPress={() => router.push('/inbox')}
          style={({ pressed }) => [
            styles.thoughts,
            {
              backgroundColor: pressed ? theme.activeSurface : theme.surfacePrimary,
              borderColor: theme.borderSubtle,
            },
          ]}
        >
          <View style={styles.thoughtsHeader}>
            <View style={styles.thoughtsCopy}>
              <Text style={[styles.thoughtsTitle, { color: theme.textPrimary }]}>Мысли</Text>
              <Text
                testID="plan-thoughts-status"
                accessibilityLiveRegion="polite"
                style={[styles.thoughtsStatus, { color: isError ? theme.errorPrimary : theme.textSecondary }]}
              >
                {status}
              </Text>
            </View>
            {isLoading ? (
              <ActivityIndicator accessibilityLabel="Загрузка мыслей" color={theme.brand} />
            ) : (
              <Text style={[styles.arrow, { color: theme.brand }]}>›</Text>
            )}
          </View>
          <Text style={[styles.thoughtsHint, { color: theme.textSecondary }]}>
            Всё, что пока не привязано ко времени
          </Text>
        </Pressable>

        {isError ? (
          <Pressable
            testID="plan-thoughts-retry"
            accessibilityRole="button"
            accessibilityLabel="Повторить загрузку мыслей"
            onPress={() => void refetch()}
            style={[styles.retry, { backgroundColor: theme.activeSurface }]}
          >
            <Text style={[styles.retryText, { color: theme.activeSurfaceText }]}>Повторить</Text>
          </Pressable>
        ) : null}

        <View style={[styles.preview, { backgroundColor: theme.surfacePrimary, borderColor: theme.borderSubtle }]}>
          <Text style={[styles.previewTitle, { color: theme.textPrimary }]}>Ближайшее, рутины и AI-план</Text>
          <Text style={[styles.previewCopy, { color: theme.textSecondary }]}>
            Эти разделы пока не показывают выдуманные данные. Добавим их отдельными проверяемыми этапами.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 },
  eyebrow: { fontSize: 13, lineHeight: 18, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  title: { marginTop: 6, fontSize: 34, lineHeight: 41, fontWeight: '800' },
  copy: { marginTop: 6, fontSize: 16, lineHeight: 24 },
  thoughts: { marginTop: 24, minHeight: 112, padding: 18, borderRadius: 18, borderWidth: 1 },
  thoughtsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  thoughtsCopy: { flex: 1 },
  thoughtsTitle: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  thoughtsStatus: { marginTop: 2, fontSize: 15, lineHeight: 21 },
  thoughtsHint: { marginTop: 12, fontSize: 14, lineHeight: 20 },
  arrow: { fontSize: 32, lineHeight: 36, fontWeight: '600' },
  retry: { marginTop: 10, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  retryText: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  preview: { marginTop: 18, padding: 18, borderRadius: 18, borderWidth: 1 },
  previewTitle: { fontSize: 17, lineHeight: 23, fontWeight: '700' },
  previewCopy: { marginTop: 6, fontSize: 15, lineHeight: 22 },
});
