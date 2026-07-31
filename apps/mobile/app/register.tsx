import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Link } from 'expo-router';
import { register as registerRequest, getMe } from '../lib/api/auth';
import { useAuthStore } from '../stores/auth.store';
import { extractErrorMessage } from '../lib/api-error';

type Identifier = 'email' | 'phone';

export default function RegisterScreen() {
  const router = useRouter();
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);

  const [identifierType, setIdentifierType] = useState<Identifier>('email');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!identifier.trim() || password.length < 8) return;
    setLoading(true);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const tokens = await registerRequest({
        [identifierType]: identifier.trim(),
        password,
        timezone,
      });
      await setTokens(tokens);
      const user = await getMe();
      setUser(user);
      router.replace('/(tabs)/today');
    } catch (err) {
      Alert.alert('Не удалось зарегистрироваться', extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const passwordTooShort = password.length > 0 && password.length < 8;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Focus</Text>
          <Text style={styles.subtitle}>Регистрация</Text>

          <View style={styles.row}>
            <Pressable
              style={[styles.toggleChip, identifierType === 'email' && styles.toggleChipActive]}
              onPress={() => setIdentifierType('email')}
            >
              <Text
                style={[
                  styles.toggleChipText,
                  identifierType === 'email' && styles.toggleChipTextActive,
                ]}
              >
                Email
              </Text>
            </Pressable>
            <Pressable
              style={[styles.toggleChip, identifierType === 'phone' && styles.toggleChipActive]}
              onPress={() => setIdentifierType('phone')}
            >
              <Text
                style={[
                  styles.toggleChipText,
                  identifierType === 'phone' && styles.toggleChipTextActive,
                ]}
              >
                Телефон
              </Text>
            </Pressable>
          </View>

          <TextInput
            style={styles.input}
            placeholder={identifierType === 'email' ? 'you@example.com' : '+7 999 000-00-00'}
            placeholderTextColor="#9CA3AF"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            keyboardType={identifierType === 'email' ? 'email-address' : 'phone-pad'}
          />
          <TextInput
            style={styles.input}
            placeholder="Пароль (минимум 8 символов)"
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            onSubmitEditing={handleRegister}
            returnKeyType="done"
          />
          {passwordTooShort && (
            <Text style={styles.hint}>Ещё {8 - password.length} симв. до минимума</Text>
          )}

          <Pressable
            style={[
              styles.submitButton,
              (loading || !identifier.trim() || password.length < 8) &&
                styles.submitButtonDisabled,
            ]}
            onPress={handleRegister}
            disabled={loading || !identifier.trim() || password.length < 8}
          >
            <Text style={styles.submitButtonText}>
              {loading ? 'Регистрируем…' : 'Зарегистрироваться'}
            </Text>
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>или</Text>
            <View style={styles.dividerLine} />
          </View>

          <Link href="/auth-provider-select" asChild>
            <Pressable style={styles.oauthButton}>
              <Text style={styles.oauthButtonText}>Войти через соцсети</Text>
            </Pressable>
          </Link>

          <Link href="/login" asChild>
            <Pressable style={styles.linkButton}>
              <Text style={styles.linkText}>Уже есть аккаунт? Войти</Text>
            </Pressable>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  title: { fontSize: 32, fontWeight: '700', color: '#6B5BFC', textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#6B7280', textAlign: 'center', marginBottom: 32, marginTop: 4 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 16, justifyContent: 'center' },
  toggleChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6' },
  toggleChipActive: { backgroundColor: '#6B5BFC' },
  toggleChipText: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  toggleChipTextActive: { color: '#FFFFFF' },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    marginBottom: 12,
  },
  hint: { fontSize: 12, color: '#F59E0B', marginTop: -8, marginBottom: 12 },
  submitButton: {
    backgroundColor: '#6B5BFC',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
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
  oauthButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  oauthButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: { marginTop: 20, alignItems: 'center' },
  linkText: { color: '#6B5BFC', fontSize: 14, fontWeight: '600' },
});
