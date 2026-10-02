import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { confirmContactVerification, registerVerified, startContactVerification, type VerificationChannel } from '../lib/api/auth';
import { useAuthStore } from '../stores/auth.store';
import { authenticationAfterRegistrationMessage, contactVerificationErrorMessage, registrationErrorMessage, registrationNetworkMessage } from '../lib/api-error';
import { FocusDialog, useFocusDialog } from '../components/FocusDialog';
import { StatusBar } from 'expo-status-bar';
import { type OrbitsThemeTokens, useOrbitsTheme } from '../theme/orbits';

type Identifier = 'email' | 'phone';
type Step = 'contact' | 'pin';
type Phase = 'idle' | 'confirmation' | 'registration' | 'authentication';
const canonical = (type: Identifier, value: string) => type === 'email' ? value.trim().toLowerCase() : value.trim();
const valid = (type: Identifier, value: string) => type === 'email' ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(canonical(type, value)) : /^\+[0-9]{8,15}$/.test(canonical(type, value));
const mask = (type: Identifier, value: string) => type === 'email' ? `${canonical(type, value).split('@')[0].slice(0, 1)}***@${canonical(type, value).split('@')[1]}` : `***${canonical(type, value).slice(-4)}`;

export default function RegisterScreen() {
  const theme = useOrbitsTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const authenticate = useAuthStore((s) => s.authenticate);
  const { showDialog, dialogProps } = useFocusDialog();
  const [identifierType, setIdentifierType] = useState<Identifier>('email');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<Step>('contact');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [resendAfter, setResendAfter] = useState(0);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const busy = useRef(false);
  useEffect(() => { if (resendAfter <= 0) return undefined; const timer = setInterval(() => setResendAfter((n) => Math.max(0, n - 1)), 1000); return () => clearInterval(timer); }, [resendAfter]);
  const contact = useMemo(() => canonical(identifierType, identifier), [identifier, identifierType]);
  const channel: VerificationChannel = identifierType === 'email' ? 'EMAIL' : 'PHONE';
  const canStart = valid(identifierType, identifier) && password.length >= 8;
  const error = (err: unknown, currentPhase: Phase) => {
    if (currentPhase === 'authentication') {
      showDialog({ title: 'Аккаунт создан', message: authenticationAfterRegistrationMessage() });
    } else if (currentPhase === 'registration') {
      const hasServerResponse = Boolean((err as { response?: unknown })?.response);
      showDialog({ title: hasServerResponse ? 'Не удалось зарегистрироваться' : 'Не удалось подтвердить регистрацию', message: hasServerResponse ? registrationErrorMessage(err) : registrationNetworkMessage() });
    } else {
      showDialog({ title: 'Не удалось проверить контакт', message: contactVerificationErrorMessage(err) });
    }
  };
  async function requestCode() {
    if (!canStart || busy.current) return; busy.current = true; setLoading(true); setPhase('confirmation');
    try { const result = await startContactVerification({ channel, destination: contact }); setChallengeId(result.challengeId); setResendAfter(result.resendAfterSeconds); setPin(''); setStep('pin'); } catch (err) { error(err, 'confirmation'); } finally { busy.current = false; setLoading(false); setPhase('idle'); }
  }
  async function confirmCode() {
    if (!challengeId || !/^\d{6}$/.test(pin) || busy.current) return; busy.current = true; setLoading(true); let currentPhase: Phase = 'confirmation'; setPhase(currentPhase);
    try { const result = await confirmContactVerification({ challengeId, code: pin }); currentPhase = 'registration'; setPhase(currentPhase); const tokens = await registerVerified({ [identifierType]: contact, password, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, ...(identifierType === 'email' ? { emailVerificationToken: result.verificationToken } : { phoneVerificationToken: result.verificationToken }) }); currentPhase = 'authentication'; setPhase(currentPhase); await authenticate(tokens); } catch (err) { error(err, currentPhase); } finally { busy.current = false; setLoading(false); setPhase('idle'); }
  }
  async function resendCode() {
    if (busy.current || resendAfter > 0 || !canStart) return; busy.current = true; setLoading(true); setPhase('confirmation');
    try { const result = await startContactVerification({ channel, destination: contact }); setChallengeId(result.challengeId); setResendAfter(result.resendAfterSeconds); setPin(''); } catch (err) { error(err, 'confirmation'); } finally { busy.current = false; setLoading(false); setPhase('idle'); }
  }
  function changeContact() { if (busy.current) return; setStep('contact'); setChallengeId(null); setPin(''); setResendAfter(0); setPhase('idle'); }
  return <><SafeAreaView testID="register-screen" style={styles.container}><StatusBar style={theme.name === 'dark' ? 'light' : 'dark'} /><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}><View style={styles.content}>
    <Text style={styles.title}>Focus</Text><Text style={styles.subtitle}>{step === 'contact' ? 'Регистрация' : 'Подтвердите контакт'}</Text>
    {step === 'contact' ? <><View style={styles.row}>{(['email', 'phone'] as const).map((type) => <Pressable key={type} accessibilityRole="button" accessibilityLabel={type === 'email' ? 'Выбрать email' : 'Выбрать телефон'} style={[styles.toggleChip, identifierType === type && styles.toggleChipActive]} onPress={() => setIdentifierType(type)} disabled={loading}>{type === 'email' ? <Text style={[styles.toggleChipText, identifierType === type && styles.toggleChipTextActive]}>Email</Text> : <Text style={[styles.toggleChipText, identifierType === type && styles.toggleChipTextActive]}>Телефон</Text>}</Pressable>)}</View><TextInput accessibilityLabel="Контакт для регистрации" style={styles.input} placeholder={identifierType === 'email' ? 'you@example.ru' : '+79991234567'} placeholderTextColor={theme.textSecondary} selectionColor={theme.brand} value={identifier} onChangeText={setIdentifier} autoCapitalize="none" keyboardType={identifierType === 'email' ? 'email-address' : 'phone-pad'} editable={!loading} /><Text style={styles.helper}>{identifierType === 'email' ? 'Введите адрес электронной почты' : 'Используйте международный формат, например +79991234567'}</Text><TextInput accessibilityLabel="Пароль" style={styles.input} placeholder="Пароль (минимум 8 символов)" placeholderTextColor={theme.textSecondary} selectionColor={theme.brand} value={password} onChangeText={setPassword} secureTextEntry returnKeyType="done" editable={!loading} /><Pressable accessibilityRole="button" accessibilityLabel="Получить код" style={[styles.submitButton, (!canStart || loading) && styles.submitButtonDisabled]} onPress={requestCode} disabled={!canStart || loading}><Text style={styles.submitButtonText}>{loading ? 'Отправляем код…' : 'Получить код'}</Text></Pressable></> : <><Text style={styles.instructions}>Код отправлен на {mask(identifierType, contact)}. Он действует 10 минут.</Text><TextInput accessibilityLabel="Код подтверждения" style={styles.input} placeholder="6-значный код" placeholderTextColor={theme.textSecondary} selectionColor={theme.brand} value={pin} onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} autoFocus textContentType={Platform.OS === 'ios' ? 'oneTimeCode' : 'none'} autoComplete="sms-otp" editable={!loading} /><Pressable accessibilityRole="button" accessibilityLabel="Подтвердить и создать аккаунт" style={[styles.submitButton, (!/^\d{6}$/.test(pin) || loading) && styles.submitButtonDisabled]} onPress={confirmCode} disabled={!/^\d{6}$/.test(pin) || loading}><Text style={styles.submitButtonText}>{loading ? (phase === 'registration' ? 'Создаём аккаунт…' : phase === 'authentication' ? 'Входим…' : 'Проверяем…') : 'Подтвердить и создать аккаунт'}</Text></Pressable><Text style={styles.helper}>Если код не пришёл, проверьте адрес или номер. Если аккаунт уже существует, попробуйте войти.</Text><Pressable accessibilityRole="button" accessibilityLabel="Отправить код снова" onPress={resendCode} disabled={loading || resendAfter > 0} style={styles.secondaryButton}><Text style={styles.linkText}>{resendAfter > 0 ? `Отправить снова через ${resendAfter} с` : 'Отправить код снова'}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Изменить контакт" onPress={changeContact} disabled={loading} style={styles.secondaryButton}><Text style={styles.mutedLink}>Изменить контакт</Text></Pressable></>}
    <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>или</Text><View style={styles.dividerLine} /></View><Link href="/auth-provider-select" asChild><Pressable style={styles.oauthButton} disabled={loading}><Text style={styles.oauthButtonText}>Войти через соцсети</Text></Pressable></Link><Link href="/login" asChild><Pressable style={styles.linkButton} disabled={loading}><Text style={styles.linkText}>Уже есть аккаунт? Войти</Text></Pressable></Link>
  </View></KeyboardAvoidingView></SafeAreaView><FocusDialog {...dialogProps} /></>;
}

function createStyles(theme: OrbitsThemeTokens) {
  return StyleSheet.create({ container: { flex: 1, backgroundColor: theme.background }, flex: { flex: 1 }, content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 }, title: { fontSize: 32, fontWeight: '700', color: theme.brand, textAlign: 'center' }, subtitle: { fontSize: 16, color: theme.textSecondary, textAlign: 'center', marginBottom: 32, marginTop: 4 }, row: { flexDirection: 'row', gap: 8, marginBottom: 16, justifyContent: 'center' }, toggleChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.surfaceMuted, borderWidth: 1, borderColor: theme.borderSubtle }, toggleChipActive: { backgroundColor: theme.activeSurface, borderColor: theme.activeBorder }, toggleChipText: { fontSize: 13, color: theme.textSecondary, fontWeight: '600' }, toggleChipTextActive: { color: theme.activeSurfaceText }, input: { borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.surfacePrimary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: theme.textPrimary, marginBottom: 12 }, helper: { fontSize: 12, color: theme.textSecondary, marginTop: -8, marginBottom: 12 }, instructions: { textAlign: 'center', color: theme.textPrimary, marginBottom: 18 }, submitButton: { backgroundColor: theme.brand, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 }, submitButtonDisabled: { opacity: 0.5 }, submitButtonText: { color: theme.retryText, fontSize: 16, fontWeight: '700' }, secondaryButton: { alignItems: 'center', paddingVertical: 10 }, divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 }, dividerLine: { flex: 1, height: 1, backgroundColor: theme.borderSubtle }, dividerText: { marginHorizontal: 16, fontSize: 14, color: theme.textSecondary }, oauthButton: { backgroundColor: theme.surfaceMuted, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: theme.borderSubtle }, oauthButtonText: { color: theme.textPrimary, fontSize: 16, fontWeight: '600' }, linkButton: { marginTop: 20, alignItems: 'center' }, linkText: { color: theme.brand, fontSize: 14, fontWeight: '600' }, mutedLink: { color: theme.textSecondary, fontSize: 14 } });
}
