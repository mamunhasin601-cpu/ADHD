import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useOrbitsTheme } from '../theme/orbits';

/**
 * Корневой маршрут показывает нейтральное состояние, пока RootLayout принимает
 * единственное авторитетное решение об auth/onboarding-навигации.
 */
export default function Index() {
  const theme = useOrbitsTheme();
  return (
    <View testID="index-screen" style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style={theme.name === 'dark' ? 'light' : 'dark'} />
      <ActivityIndicator color={theme.brand} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
