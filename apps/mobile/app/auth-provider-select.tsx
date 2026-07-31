import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useAuthStore } from '../stores/auth.store';
import { useState, useEffect } from 'react';

WebBrowser.maybeCompleteAuthSession();

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Экран выбора OAuth провайдера.
 * Показывается на экранах login/register.
 */
export default function AuthProviderSelectScreen() {
  const router = useRouter();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [isLoading, setIsLoading] = useState(false);

  // Обработка deep link callback от OAuth
  useEffect(() => {
    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => subscription.remove();
  }, []);

  async function handleDeepLink(event: { url: string }) {
    const url = new URL(event.url);
    if (url.pathname === '/auth/callback') {
      const accessToken = url.searchParams.get('accessToken');
      const refreshToken = url.searchParams.get('refreshToken');

      if (accessToken && refreshToken) {
        await setTokens({ accessToken, refreshToken });
        router.replace('/(tabs)/today');
      } else {
        Alert.alert('Ошибка', 'Не удалось получить токены авторизации');
      }
    }
  }

  async function handleYandexLogin() {
    setIsLoading(true);
    try {
      const result = await WebBrowser.openAuthSessionAsync(
        `${API_BASE_URL}/auth/yandex`,
        'focus://auth/callback',
      );

      if (result.type === 'success') {
        // Deep link обработается в handleDeepLink
      } else if (result.type === 'cancel') {
        Alert.alert('Отменено', 'Вход через Яндекс был отменён');
      }
    } catch (error) {
      console.error('Yandex OAuth error:', error);
      Alert.alert('Ошибка', 'Не удалось войти через Яндекс');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVKLogin() {
    Alert.alert('Скоро', 'Вход через VK будет доступен в следующем обновлении');
  }

  async function handleMailRuLogin() {
    Alert.alert('Скоро', 'Вход через Mail.ru будет доступен в следующем обновлении');
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.content}>
        <Text style={styles.title}>Войти через</Text>
        <Text style={styles.subtitle}>Выберите удобный способ</Text>

        <View style={styles.providers}>
          <Pressable
            style={[styles.providerButton, styles.yandex]}
            onPress={handleYandexLogin}
            disabled={isLoading}
          >
            <Text style={styles.providerIcon}>Я</Text>
            <Text style={styles.providerText}>Яндекс</Text>
          </Pressable>

          <Pressable
            style={[styles.providerButton, styles.vk, styles.disabled]}
            onPress={handleVKLogin}
            disabled
          >
            <Text style={styles.providerIcon}>ВК</Text>
            <Text style={[styles.providerText, styles.disabledText]}>VK (скоро)</Text>
          </Pressable>

          <Pressable
            style={[styles.providerButton, styles.mailru, styles.disabled]}
            onPress={handleMailRuLogin}
            disabled
          >
            <Text style={styles.providerIcon}>@</Text>
            <Text style={[styles.providerText, styles.disabledText]}>Mail.ru (скоро)</Text>
          </Pressable>
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>или</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable style={styles.emailButton} onPress={() => router.back()}>
          <Text style={styles.emailButtonText}>Email / Телефон</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 40,
  },
  providers: {
    gap: 12,
    marginBottom: 32,
  },
  providerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  yandex: {
    borderColor: '#FC3F1D',
  },
  vk: {
    borderColor: '#0077FF',
  },
  mailru: {
    borderColor: '#005FF9',
  },
  disabled: {
    opacity: 0.5,
    borderColor: '#E5E7EB',
  },
  providerIcon: {
    fontSize: 24,
    fontWeight: '700',
    marginRight: 16,
  },
  providerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  disabledText: {
    color: '#9CA3AF',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#9CA3AF',
  },
  emailButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#6B5BFC',
    alignItems: 'center',
  },
  emailButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
