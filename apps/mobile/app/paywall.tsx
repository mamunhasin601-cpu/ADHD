import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { usePlanInfo } from '../lib/api/plan';
import { FREE_TIER_LIMITS } from '@focus/shared-types';
import { useMemo } from 'react';
import { type OrbitsThemeTokens, useOrbitsTheme } from '../theme/orbits';

/** Honest limit screen: purchasing and production entitlement activation are not implemented. */
export default function PaywallScreen() {
  const theme = useOrbitsTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const { data: planInfo, isLoading, isError } = usePlanInfo();
  const limit = FREE_TIER_LIMITS.maxActiveTasks;
  const activeTasks = planInfo?.usage.activeTasks;
  const usagePercent = activeTasks === undefined ? 0 : Math.min((activeTasks / limit) * 100, 100);

  return (
    <SafeAreaView testID="paywall-screen" style={styles.container}>
      <StatusBar style={theme.name === 'dark' ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.emoji} accessibilityElementsHidden>🌿</Text>
          <Text style={styles.title}>Лимит плана Free</Text>
          <Text style={styles.subtitle}>
            В плане Free можно иметь до {limit} активных задач.
          </Text>
        </View>

        <View testID="paywall-card" style={styles.card}>
          {isLoading ? (
            <View style={styles.status} accessibilityRole="progressbar">
              <ActivityIndicator color={theme.brand} />
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

function createStyles(theme: OrbitsThemeTokens) {
return StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 },
  header: { alignItems: 'center', marginBottom: 24 },
  emoji: { fontSize: 56, marginBottom: 16 },
  title: { fontSize: 30, fontWeight: '700', color: theme.textPrimary, marginBottom: 12, textAlign: 'center' },
  subtitle: { fontSize: 16, color: theme.textSecondary, textAlign: 'center', lineHeight: 24 },
  card: { backgroundColor: theme.surfacePrimary, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: theme.borderSubtle },
  status: { alignItems: 'center', gap: 10 },
  statusText: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 21 },
  usageBar: { height: 8, backgroundColor: theme.surfaceMuted, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  usageFill: { height: '100%', backgroundColor: theme.brand, borderRadius: 4 },
  usageText: { fontSize: 13, color: theme.textSecondary, textAlign: 'center' },
  guidance: { fontSize: 16, color: theme.textPrimary, textAlign: 'center', lineHeight: 24, marginTop: 24 },
  backButton: { backgroundColor: theme.brand, borderRadius: 14, paddingVertical: 17, alignItems: 'center', marginTop: 24 },
  backButtonText: { color: theme.retryText, fontSize: 17, fontWeight: '700' },
});
}
