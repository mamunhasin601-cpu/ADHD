import { View, ActivityIndicator, StyleSheet } from 'react-native';

/**
 * Корневой маршрут показывает нейтральное состояние, пока RootLayout принимает
 * единственное авторитетное решение об auth/onboarding-навигации.
 */
export default function Index() {
  return (
    <View style={styles.container}>
      <ActivityIndicator color="#6B5BFC" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
});
