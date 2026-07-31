import { Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '../stores/auth.store';

/**
 * Корневой маршрут. Ждёт bootstrap() и решает:
 * - Нет авторизации → /login
 * - Есть авторизация + не завершен онбординг → /onboarding
 * - Есть авторизация + завершен онбординг → /(tabs)/today
 */
export default function Index() {
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#6B5BFC" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  // Если пользователь не завершил онбординг — ведем на /onboarding
  if (user && !user.hasCompletedOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)/today" />;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
});
