import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
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
import { FocusDialog, useFocusDialog } from '../components/FocusDialog';
import { useOrbitsTheme } from '../theme/orbits';

WebBrowser.maybeCompleteAuthSession();

type ProviderKey = keyof OAuthProviderAvailability;

const PROVIDERS: Array<{ key: ProviderKey; label: string; icon: string; style: 'yandex' | 'vk' | 'mailru' }> = [
  { key: 'yandex', label: 'Яндекс', icon: 'Я', style: 'yandex' },
  { key: 'vk', label: 'VK', icon: 'ВК', style: 'vk' },
  { key: 'mailru', label: 'Mail.ru', icon: '@', style: 'mailru' },
];

const DISCOVERY_ERROR = 'Вход через сервисы сейчас недоступен. Используйте email или телефон.';

export default function AuthProviderSelectScreen() {
  const theme = useOrbitsTheme();
  const router = useRouter();
  const { showDialog, dialogProps } = useFocusDialog();
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
        showDialog({ title: 'Ошибка', message: 'Не удалось получить токены авторизации' });
        return;
      }

      await authenticate({ accessToken, refreshToken });
    } catch {
      showDialog({ title: 'Ошибка', message: 'Не удалось проверить сессию после входа' });
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
        showDialog({ title: 'Отменено', message: 'Вход через выбранный сервис был отменён' });
      }
    } catch {
      showDialog({ title: 'Ошибка', message: 'Не удалось войти через выбранный сервис' });
    } finally {
      setIsLoading(false);
    }
  }

  const enabledProviders = availability
    ? PROVIDERS.filter((provider) => availability[provider.key] === true)
    : [];

  return (
    <>
    <SafeAreaView testID="auth-provider-screen" style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style={theme.name === 'dark' ? 'light' : 'dark'} />
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Войти через</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Выберите удобный способ</Text>

        {discoveryFailed ? (
          <Text testID="oauth-discovery-error" style={[styles.notice, { color: theme.errorPrimary }]}>{DISCOVERY_ERROR}</Text>
        ) : availability === null ? (
          <Text testID="oauth-discovery-loading" style={[styles.notice, { color: theme.textSecondary }]}>Проверяем доступность сервисов…</Text>
        ) : enabledProviders.length > 0 ? (
          <View style={styles.providers}>
            {enabledProviders.map((provider) => (
              <Pressable
                key={provider.key}
                testID={`oauth-provider-${provider.key}`}
                style={[styles.providerButton, { backgroundColor: theme.surfacePrimary, borderColor: theme.borderSubtle }, styles[provider.style]]}
                onPress={() => void handleProviderLogin(provider.key)}
                disabled={isLoading}
              >
                <Text style={[styles.providerIcon, { color: theme.textPrimary }]}>{provider.icon}</Text>
                <Text style={[styles.providerText, { color: theme.textPrimary }]}>{provider.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: theme.borderSubtle }]} />
          <Text style={[styles.dividerText, { color: theme.textSecondary }]}>или</Text>
          <View style={[styles.dividerLine, { backgroundColor: theme.borderSubtle }]} />
        </View>

        <Pressable testID="email-phone-button" style={[styles.emailButton, { backgroundColor: theme.brand }]} onPress={() => router.back()}>
          <Text style={[styles.emailButtonText, { color: theme.retryText }]}>Email / Телефон</Text>
        </Pressable>
      </View>
    </SafeAreaView>
    <FocusDialog {...dialogProps} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 32, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 40 },
  notice: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 24 },
  providers: { gap: 12, marginBottom: 32 },
  providerButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1 },
  yandex: { borderColor: '#FC3F1D' },
  vk: { borderColor: '#0077FF' },
  mailru: { borderColor: '#005FF9' },
  providerIcon: { fontSize: 24, fontWeight: '700', marginRight: 16 },
  providerText: { fontSize: 16, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { marginHorizontal: 16, fontSize: 14 },
  emailButton: { paddingVertical: 16, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center' },
  emailButtonText: { fontSize: 16, fontWeight: '600' },
});
