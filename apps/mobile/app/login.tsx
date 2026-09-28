import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { login as loginRequest } from '../lib/api/auth';
import { useAuthStore } from '../stores/auth.store';
import { extractErrorMessage } from '../lib/api-error';
import { FocusDialog, useFocusDialog } from '../components/FocusDialog';
import { StatusBar } from 'expo-status-bar';
import { useOrbitsTheme } from '../theme/orbits';

type Identifier = 'email' | 'phone';

export default function LoginScreen() {
  const theme = useOrbitsTheme();
  const authenticate = useAuthStore((s) => s.authenticate);
  const { showDialog, dialogProps } = useFocusDialog();

  const [identifierType, setIdentifierType] = useState<Identifier>('email');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!identifier.trim() || !password) return;
    setLoading(true);
    try {
      const tokens = await loginRequest({
        [identifierType]: identifier.trim(),
        password,
      });
      await authenticate(tokens);
    } catch (err) {
      showDialog({ title: 'Не удалось войти', message: extractErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
    <SafeAreaView testID="login-screen" style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style={theme.name === 'dark' ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          testID="login-scroll"
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
          automaticallyAdjustKeyboardInsets
        >
          <Text style={[styles.title, { color: theme.brand }]}>Focus</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Вход</Text>

          <View style={styles.row}>
            <Pressable
              style={[styles.toggleChip, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle }, identifierType === 'email' && { backgroundColor: theme.activeSurface, borderColor: theme.activeBorder }]}
              onPress={() => setIdentifierType('email')}
            >
              <Text
                style={[
                  styles.toggleChipText,
                  { color: theme.textSecondary },
                  identifierType === 'email' && { color: theme.activeSurfaceText },
                ]}
              >
                Email
              </Text>
            </Pressable>
            <Pressable
              style={[styles.toggleChip, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle }, identifierType === 'phone' && { backgroundColor: theme.activeSurface, borderColor: theme.activeBorder }]}
              onPress={() => setIdentifierType('phone')}
            >
              <Text
                style={[
                  styles.toggleChipText,
                  { color: theme.textSecondary },
                  identifierType === 'phone' && { color: theme.activeSurfaceText },
                ]}
              >
                Телефон
              </Text>
            </Pressable>
          </View>

          <TextInput
            style={[styles.input, { backgroundColor: theme.surfacePrimary, borderColor: theme.borderSubtle, color: theme.textPrimary }]}
            placeholder={identifierType === 'email' ? 'you@example.com' : '+7 999 000-00-00'}
            placeholderTextColor={theme.textSecondary}
            selectionColor={theme.brand}
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            keyboardType={identifierType === 'email' ? 'email-address' : 'phone-pad'}
          />
          <TextInput
            style={[styles.input, { backgroundColor: theme.surfacePrimary, borderColor: theme.borderSubtle, color: theme.textPrimary }]}
            placeholder="Пароль"
            placeholderTextColor={theme.textSecondary}
            selectionColor={theme.brand}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            onSubmitEditing={handleLogin}
            returnKeyType="done"
          />

          <Pressable
            style={[
              styles.submitButton,
              { backgroundColor: theme.brand },
              (loading || !identifier.trim() || !password) && styles.submitButtonDisabled,
            ]}
            onPress={handleLogin}
            disabled={loading || !identifier.trim() || !password}
          >
            <Text style={[styles.submitButtonText, { color: theme.retryText }]}>{loading ? 'Входим…' : 'Войти'}</Text>
          </Pressable>

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: theme.borderSubtle }]} />
            <Text style={[styles.dividerText, { color: theme.textSecondary }]}>или</Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.borderSubtle }]} />
          </View>

          <Link href="/auth-provider-select" asChild>
            <Pressable style={[styles.oauthButton, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle }]}>
              <Text style={[styles.oauthButtonText, { color: theme.textPrimary }]}>Войти через соцсети</Text>
            </Pressable>
          </Link>

          <Link href="/register" asChild>
            <Pressable style={styles.linkButton}>
              <Text style={[styles.linkText, { color: theme.brand }]}>Нет аккаунта? Зарегистрироваться</Text>
            </Pressable>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    <FocusDialog {...dialogProps} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 24 },
  title: { fontSize: 32, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 32, marginTop: 4 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 16, justifyContent: 'center' },
  toggleChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  toggleChipText: { fontSize: 13, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { fontSize: 16, fontWeight: '700' },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
  },
  oauthButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  oauthButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: { marginTop: 20, alignItems: 'center' },
  linkText: { fontSize: 14, fontWeight: '600' },
});
