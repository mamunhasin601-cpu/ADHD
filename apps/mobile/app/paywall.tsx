import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { usePlanInfo } from '../lib/api/plan';
import { FREE_TIER_LIMITS } from '@focus/shared-types';

/** Honest limit screen: purchasing and production entitlement activation are not implemented. */
export default function PaywallScreen() {
  const router = useRouter();
  const { data: planInfo, isLoading, isError } = usePlanInfo();
  const limit = FREE_TIER_LIMITS.maxActiveTasks;
  const activeTasks = planInfo?.usage.activeTasks;
  const usagePercent = activeTasks === undefined ? 0 : Math.min((activeTasks / limit) * 100, 100);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.emoji} accessibilityElementsHidden>🌿</Text>
          <Text style={styles.title}>Лимит плана Free</Text>
          <Text style={styles.subtitle}>
            В плане Free можно иметь до {limit} активных задач.
          </Text>
        </View>

        <View style={styles.card}>
          {isLoading ? (
            <View style={styles.status} accessibilityRole="progressbar">
              <ActivityIndicator color="#6B5BFC" />
              <Text style={styles.statusText}>Проверяем количество задач…</Text>
            </View>
          ) : isError ? (
            <Text style={styles.statusText} accessibilityRole="alert">
              Не удалось загрузить текущее количество. Ваш план и задачи не изменились.
            </Text>
          ) : (
            <>
              <View style={styles.usageBar}>
                <View style={[styles.usageFill, { width: `${usagePercent}%` as any }]} />
              </View>
              <Text style={styles.usageText}>
                {activeTasks} из {limit} активных задач использовано
              </Text>
            </>
          )}

          <Text style={styles.guidance}>
            Можно вернуться к задачам и завершить, изменить или удалить существующую работу.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Вернуться к задачам</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 },
  header: { alignItems: 'center', marginBottom: 24 },
  emoji: { fontSize: 56, marginBottom: 16 },
  title: { fontSize: 30, fontWeight: '700', color: '#111827', marginBottom: 12, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#6B7280', textAlign: 'center', lineHeight: 24 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  status: { alignItems: 'center', gap: 10 },
  statusText: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 21 },
  usageBar: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  usageFill: { height: '100%', backgroundColor: '#6B5BFC', borderRadius: 4 },
  usageText: { fontSize: 13, color: '#6B7280', textAlign: 'center' },
  guidance: { fontSize: 16, color: '#374151', textAlign: 'center', lineHeight: 24, marginTop: 24 },
  backButton: { backgroundColor: '#6B5BFC', borderRadius: 14, paddingVertical: 17, alignItems: 'center', marginTop: 24 },
  backButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
});
