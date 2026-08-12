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
import { Link } from 'expo-router';
import { login as loginRequest } from '../lib/api/auth';
import { useAuthStore } from '../stores/auth.store';
import { extractErrorMessage } from '../lib/api-error';

type Identifier = 'email' | 'phone';

export default function LoginScreen() {
  const authenticate = useAuthStore((s) => s.authenticate);

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
      Alert.alert('Не удалось войти', extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Focus</Text>
          <Text style={styles.subtitle}>Вход</Text>

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
            placeholder="Пароль"
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            onSubmitEditing={handleLogin}
            returnKeyType="done"
          />

          <Pressable
            style={[
              styles.submitButton,
              (loading || !identifier.trim() || !password) && styles.submitButtonDisabled,
            ]}
            onPress={handleLogin}
            disabled={loading || !identifier.trim() || !password}
          >
            <Text style={styles.submitButtonText}>{loading ? 'Входим…' : 'Войти'}</Text>
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

          <Link href="/register" asChild>
            <Pressable style={styles.linkButton}>
              <Text style={styles.linkText}>Нет аккаунта? Зарегистрироваться</Text>
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
