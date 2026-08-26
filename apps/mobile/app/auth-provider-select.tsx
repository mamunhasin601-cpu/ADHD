import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useAuthStore } from '../stores/auth.store';
import {
  getOAuthProviderAvailability,
  type OAuthProviderAvailability,
} from '../lib/api/auth';
import { API_BASE_URL } from '../lib/api-client';

WebBrowser.maybeCompleteAuthSession();

type ProviderKey = keyof OAuthProviderAvailability;

const PROVIDERS: Array<{ key: ProviderKey; label: string; icon: string; style: 'yandex' | 'vk' | 'mailru' }> = [
  { key: 'yandex', label: 'Яндекс', icon: 'Я', style: 'yandex' },
  { key: 'vk', label: 'VK', icon: 'ВК', style: 'vk' },
  { key: 'mailru', label: 'Mail.ru', icon: '@', style: 'mailru' },
];

const DISCOVERY_ERROR = 'Вход через сервисы сейчас недоступен. Используйте email или телефон.';

export default function AuthProviderSelectScreen() {
  const router = useRouter();
  const authenticate = useAuthStore((s) => s.authenticate);
  const [availability, setAvailability] = useState<OAuthProviderAvailability | null>(null);
  const [discoveryFailed, setDiscoveryFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    getOAuthProviderAvailability()
      .then((result) => {
        if (mounted) setAvailability(result);
      })
      .catch(() => {
        if (mounted) setDiscoveryFailed(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', (event) => {
      void handleDeepLink(event);
    });
    return () => subscription.remove();
  }, []);

  async function handleDeepLink(event: { url: string }) {
    try {
      const url = new URL(event.url);
      if (url.pathname !== '/auth/callback' && !(url.hostname === 'auth' && url.pathname === '/callback')) return;

      const accessToken = url.searchParams.get('accessToken');
      const refreshToken = url.searchParams.get('refreshToken');
      if (!accessToken || !refreshToken) {
        Alert.alert('Ошибка', 'Не удалось получить токены авторизации');
        return;
      }

      await authenticate({ accessToken, refreshToken });
    } catch {
      Alert.alert('Ошибка', 'Не удалось проверить сессию после входа');
    }
  }

  async function handleProviderLogin(provider: ProviderKey) {
    if (isLoading || !availability?.[provider]) return;
    setIsLoading(true);
    try {
      const result = await WebBrowser.openAuthSessionAsync(
        `${API_BASE_URL}/auth/${provider}`,
        'focus://auth/callback',
      );
      if (result.type === 'cancel') {
        Alert.alert('Отменено', 'Вход через выбранный сервис был отменён');
      }
    } catch {
      Alert.alert('Ошибка', 'Не удалось войти через выбранный сервис');
    } finally {
      setIsLoading(false);
    }
  }

  const enabledProviders = availability
    ? PROVIDERS.filter((provider) => availability[provider.key] === true)
    : [];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.content}>
        <Text style={styles.title}>Войти через</Text>
        <Text style={styles.subtitle}>Выберите удобный способ</Text>

        {discoveryFailed ? (
          <Text testID="oauth-discovery-error" style={styles.notice}>{DISCOVERY_ERROR}</Text>
        ) : availability === null ? (
          <Text testID="oauth-discovery-loading" style={styles.notice}>Проверяем доступность сервисов…</Text>
        ) : enabledProviders.length > 0 ? (
          <View style={styles.providers}>
            {enabledProviders.map((provider) => (
              <Pressable
                key={provider.key}
                testID={`oauth-provider-${provider.key}`}
                style={[styles.providerButton, styles[provider.style]]}
                onPress={() => void handleProviderLogin(provider.key)}
                disabled={isLoading}
              >
                <Text style={styles.providerIcon}>{provider.icon}</Text>
                <Text style={styles.providerText}>{provider.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>или</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable testID="email-phone-button" style={styles.emailButton} onPress={() => router.back()}>
          <Text style={styles.emailButtonText}>Email / Телефон</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { flex: 1, paddingHorizontal: 32, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#6B7280', textAlign: 'center', marginBottom: 40 },
  notice: { color: '#6B7280', fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 24 },
  providers: { gap: 12, marginBottom: 32 },
  providerButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  yandex: { borderColor: '#FC3F1D' },
  vk: { borderColor: '#0077FF' },
  mailru: { borderColor: '#005FF9' },
  providerIcon: { fontSize: 24, fontWeight: '700', marginRight: 16 },
  providerText: { fontSize: 16, fontWeight: '600', color: '#111827' },
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { marginHorizontal: 16, fontSize: 14, color: '#9CA3AF' },
  emailButton: { paddingVertical: 16, paddingHorizontal: 24, borderRadius: 12, backgroundColor: '#6B5BFC', alignItems: 'center' },
  emailButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
