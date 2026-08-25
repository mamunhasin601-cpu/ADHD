import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { confirmContactVerification, registerVerified, startContactVerification, type VerificationChannel } from '../lib/api/auth';
import { useAuthStore } from '../stores/auth.store';
import { contactVerificationErrorMessage, registrationErrorMessage } from '../lib/api-error';

type Identifier = 'email' | 'phone';
type Step = 'contact' | 'pin';
const canonical = (type: Identifier, value: string) => type === 'email' ? value.trim().toLowerCase() : value.trim();
const valid = (type: Identifier, value: string) => type === 'email' ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(canonical(type, value)) : /^\+[0-9]{8,15}$/.test(canonical(type, value));
const mask = (type: Identifier, value: string) => type === 'email' ? `${canonical(type, value).split('@')[0].slice(0, 1)}***@${canonical(type, value).split('@')[1]}` : `***${canonical(type, value).slice(-4)}`;

export default function RegisterScreen() {
  const authenticate = useAuthStore((s) => s.authenticate);
  const [identifierType, setIdentifierType] = useState<Identifier>('email');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<Step>('contact');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [resendAfter, setResendAfter] = useState(0);
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);
  useEffect(() => { if (resendAfter <= 0) return undefined; const timer = setInterval(() => setResendAfter((n) => Math.max(0, n - 1)), 1000); return () => clearInterval(timer); }, [resendAfter]);
  const contact = useMemo(() => canonical(identifierType, identifier), [identifier, identifierType]);
  const channel: VerificationChannel = identifierType === 'email' ? 'EMAIL' : 'PHONE';
  const canStart = valid(identifierType, identifier) && password.length >= 8;
  const error = (err: unknown, registration = false) => Alert.alert(registration ? 'Не удалось зарегистрироваться' : 'Не удалось проверить контакт', registration ? registrationErrorMessage(err) : contactVerificationErrorMessage(err));
  async function requestCode() {
    if (!canStart || busy.current) return; busy.current = true; setLoading(true);
    try { const result = await startContactVerification({ channel, destination: contact }); setChallengeId(result.challengeId); setResendAfter(result.resendAfterSeconds); setPin(''); setStep('pin'); } catch (err) { error(err); } finally { busy.current = false; setLoading(false); }
  }
  async function confirmCode() {
    if (!challengeId || !/^\d{6}$/.test(pin) || busy.current) return; busy.current = true; setLoading(true); let registering = false;
    try { const result = await confirmContactVerification({ challengeId, code: pin }); registering = true; const tokens = await registerVerified({ [identifierType]: contact, password, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, ...(identifierType === 'email' ? { emailVerificationToken: result.verificationToken } : { phoneVerificationToken: result.verificationToken }) }); await authenticate(tokens); } catch (err) { error(err, registering); } finally { busy.current = false; setLoading(false); }
  }
  async function resendCode() {
    if (busy.current || resendAfter > 0 || !canStart) return; busy.current = true; setLoading(true);
    try { const result = await startContactVerification({ channel, destination: contact }); setChallengeId(result.challengeId); setResendAfter(result.resendAfterSeconds); setPin(''); } catch (err) { error(err); } finally { busy.current = false; setLoading(false); }
  }
  function changeContact() { setStep('contact'); setChallengeId(null); setPin(''); setResendAfter(0); }
  return <SafeAreaView style={styles.container}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}><View style={styles.content}>
    <Text style={styles.title}>Focus</Text><Text style={styles.subtitle}>{step === 'contact' ? 'Регистрация' : 'Подтвердите контакт'}</Text>
    {step === 'contact' ? <><View style={styles.row}>{(['email', 'phone'] as const).map((type) => <Pressable key={type} accessibilityRole="button" accessibilityLabel={type === 'email' ? 'Выбрать email' : 'Выбрать телефон'} style={[styles.toggleChip, identifierType === type && styles.toggleChipActive]} onPress={() => setIdentifierType(type)}><Text style={[styles.toggleChipText, identifierType === type && styles.toggleChipTextActive]}>{type === 'email' ? 'Email' : 'Телефон'}</Text></Pressable>)}</View><TextInput accessibilityLabel="Контакт для регистрации" style={styles.input} placeholder={identifierType === 'email' ? 'you@example.ru' : '+79991234567'} placeholderTextColor="#9CA3AF" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" keyboardType={identifierType === 'email' ? 'email-address' : 'phone-pad'} /><Text style={styles.helper}>{identifierType === 'email' ? 'Введите адрес электронной почты' : 'Используйте международный формат, например +79991234567'}</Text><TextInput accessibilityLabel="Пароль" style={styles.input} placeholder="Пароль (минимум 8 символов)" placeholderTextColor="#9CA3AF" value={password} onChangeText={setPassword} secureTextEntry returnKeyType="done" /><Pressable accessibilityRole="button" accessibilityLabel="Получить код" style={[styles.submitButton, (!canStart || loading) && styles.submitButtonDisabled]} onPress={requestCode} disabled={!canStart || loading}><Text style={styles.submitButtonText}>{loading ? 'Отправляем код…' : 'Получить код'}</Text></Pressable></> : <><Text style={styles.instructions}>Код отправлен на {mask(identifierType, contact)}. Он действует 10 минут.</Text><TextInput accessibilityLabel="Код подтверждения" style={styles.input} placeholder="6-значный код" placeholderTextColor="#9CA3AF" value={pin} onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} autoFocus textContentType={Platform.OS === 'ios' ? 'oneTimeCode' : 'none'} autoComplete="sms-otp" /><Pressable accessibilityRole="button" accessibilityLabel="Подтвердить и создать аккаунт" style={[styles.submitButton, (!/^\d{6}$/.test(pin) || loading) && styles.submitButtonDisabled]} onPress={confirmCode} disabled={!/^\d{6}$/.test(pin) || loading}><Text style={styles.submitButtonText}>{loading ? 'Проверяем…' : 'Подтвердить и создать аккаунт'}</Text></Pressable><Text style={styles.helper}>Если код не пришёл, проверьте адрес или номер. Если аккаунт уже существует, попробуйте войти.</Text><Pressable accessibilityRole="button" accessibilityLabel="Отправить код снова" onPress={resendCode} disabled={loading || resendAfter > 0} style={styles.secondaryButton}><Text style={styles.linkText}>{resendAfter > 0 ? `Отправить снова через ${resendAfter} с` : 'Отправить код снова'}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Изменить контакт" onPress={changeContact} style={styles.secondaryButton}><Text style={styles.mutedLink}>Изменить контакт</Text></Pressable></>}
    <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>или</Text><View style={styles.dividerLine} /></View><Link href="/auth-provider-select" asChild><Pressable style={styles.oauthButton}><Text style={styles.oauthButtonText}>Войти через соцсети</Text></Pressable></Link><Link href="/login" asChild><Pressable style={styles.linkButton}><Text style={styles.linkText}>Уже есть аккаунт? Войти</Text></Pressable></Link>
  </View></KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#FFFFFF' }, flex: { flex: 1 }, content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 }, title: { fontSize: 32, fontWeight: '700', color: '#6B5BFC', textAlign: 'center' }, subtitle: { fontSize: 16, color: '#6B7280', textAlign: 'center', marginBottom: 32, marginTop: 4 }, row: { flexDirection: 'row', gap: 8, marginBottom: 16, justifyContent: 'center' }, toggleChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6' }, toggleChipActive: { backgroundColor: '#6B5BFC' }, toggleChipText: { fontSize: 13, color: '#6B7280', fontWeight: '600' }, toggleChipTextActive: { color: '#FFFFFF' }, input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#111827', marginBottom: 12 }, helper: { fontSize: 12, color: '#6B7280', marginTop: -8, marginBottom: 12 }, instructions: { textAlign: 'center', color: '#374151', marginBottom: 18 }, submitButton: { backgroundColor: '#6B5BFC', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 }, submitButtonDisabled: { opacity: 0.5 }, submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' }, secondaryButton: { alignItems: 'center', paddingVertical: 10 }, divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 }, dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' }, dividerText: { marginHorizontal: 16, fontSize: 14, color: '#9CA3AF' }, oauthButton: { backgroundColor: '#F3F4F6', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' }, oauthButtonText: { color: '#374151', fontSize: 16, fontWeight: '600' }, linkButton: { marginTop: 20, alignItems: 'center' }, linkText: { color: '#6B5BFC', fontSize: 14, fontWeight: '600' }, mutedLink: { color: '#6B7280', fontSize: 14 } });
