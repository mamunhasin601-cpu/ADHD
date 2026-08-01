import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/auth.store';

export default function SettingsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  function handleLogout() {
    Alert.alert('Выйти из аккаунта?', undefined, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Выйти',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>⚙️</Text>
        <Text style={styles.title}>Настройки</Text>
        {user && <Text style={styles.userInfo}>{user.email ?? user.phone}</Text>}
        <Text style={styles.text}>Профиль, уведомления, часовой пояс</Text>

        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Выйти</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '600', color: '#111827', marginBottom: 8 },
  userInfo: { fontSize: 14, color: '#6B5BFC', fontWeight: '600', marginBottom: 4 },
  text: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  logoutButton: { marginTop: 32, paddingVertical: 12, paddingHorizontal: 24 },
  logoutText: { color: '#EF4444', fontSize: 15, fontWeight: '600' },
});
