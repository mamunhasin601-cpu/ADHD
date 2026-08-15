import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { Task, User } from '@focus/shared-types';
import { useCreateTask } from '../lib/api/tasks';
import { apiClient } from '../lib/api-client';
import { useAuthStore } from '../stores/auth.store';

type FlowError = 'create' | 'complete' | 'skip' | null;

export default function OnboardingScreen() {
  const setUser = useAuthStore((state) => state.setUser);
  const profileTimezone = useAuthStore((state) => state.user?.timezone);
  const createTask = useCreateTask(new Date(), profileTimezone);
  const [step, setStep] = useState<'welcome' | 'intention'>('welcome');
  const [taskTitle, setTaskTitle] = useState('');
  const [createdTask, setCreatedTask] = useState<Task | null>(null);
  const [error, setError] = useState<FlowError>(null);
  const [pending, setPending] = useState(false);
  const mountedRef = useRef(true);
  const busyRef = useRef(false);
  const operationRef = useRef(0);

  useEffect(() => () => {
    mountedRef.current = false;
    operationRef.current += 1;
    busyRef.current = false;
  }, []);

  async function finishProfile(operation: number, failure: 'complete' | 'skip') {
    try {
      const { data: updatedUser } = await apiClient.patch<User>('/users/me', {
        hasCompletedOnboarding: true,
      });
      if (mountedRef.current && operationRef.current === operation) {
        setUser(updatedUser);
      }
    } catch {
      if (mountedRef.current && operationRef.current === operation) setError(failure);
    } finally {
      if (operationRef.current === operation) {
        busyRef.current = false;
        if (mountedRef.current) setPending(false);
      }
    }
  }

  function beginOperation(): number | null {
    if (busyRef.current) return null;
    busyRef.current = true;
    const operation = ++operationRef.current;
    setError(null);
    setPending(true);
    return operation;
  }

  async function handleSkip() {
    const operation = beginOperation();
    if (operation === null) return;
    await finishProfile(operation, 'skip');
  }

  async function handleSubmit() {
    const title = taskTitle.trim();
    if (!title) return;
    const operation = beginOperation();
    if (operation === null) return;

    if (createdTask) {
      await finishProfile(operation, 'complete');
      return;
    }

    const startTime = new Date().toISOString();
    try {
      const canonicalTask = await createTask.mutateAsync({
        title,
        startTime,
        durationMinutes: null,
      });
      if (!mountedRef.current || operationRef.current !== operation) return;
      setCreatedTask(canonicalTask);
      await finishProfile(operation, 'complete');
    } catch {
      if (mountedRef.current && operationRef.current === operation) {
        setError('create');
        busyRef.current = false;
        setPending(false);
      }
    }
  }

  const titleIsBlank = !taskTitle.trim();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {step === 'welcome' ? (
            <>
              <Text style={styles.emoji}>👋</Text>
              <Text style={styles.title}>Добро пожаловать в Focus</Text>
              <Text style={styles.description}>
                Focus помогает увидеть одно доступное следующее действие. План не должен быть идеальным.
              </Text>
              {error === 'skip' && (
                <Text accessibilityRole="alert" style={styles.error}>
                  Не получилось завершить настройку. Можно спокойно попробовать снова.
                </Text>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: pending, busy: pending }}
                disabled={pending}
                style={[styles.button, pending && styles.buttonDisabled]}
                onPress={() => setStep('intention')}
              >
                <Text style={styles.buttonText}>Продолжить</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: pending, busy: pending }}
                disabled={pending}
                style={styles.secondaryButton}
                onPress={handleSkip}
              >
                <Text style={styles.secondaryButtonText}>
                  {pending ? 'Завершаем…' : error === 'skip' ? 'Попробовать снова' : 'Пока пропустить'}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.emoji}>✨</Text>
              <Text style={styles.title}>Что важно сделать сейчас?</Text>
              <Text style={styles.description}>
                Достаточно короткого названия. Остальное можно уточнить позже.
              </Text>
              <View style={styles.form}>
                <Text style={styles.label}>Название</Text>
                <TextInput
                  accessibilityLabel="Название первой задачи"
                  style={styles.input}
                  placeholder="Например: Позвонить маме"
                  placeholderTextColor="#9CA3AF"
                  value={taskTitle}
                  onChangeText={setTaskTitle}
                  onSubmitEditing={handleSubmit}
                  editable={!pending && !createdTask}
                  returnKeyType="done"
                  autoFocus
                />
              </View>
              {createdTask && error === 'complete' && (
                <Text style={styles.saved}>Намерение сохранено.</Text>
              )}
              {error && error !== 'skip' && (
                <Text accessibilityRole="alert" style={styles.error}>
                  {error === 'create'
                    ? 'Не получилось сохранить намерение. Оно осталось здесь — попробуйте снова.'
                    : 'Намерение сохранено, но переход не завершён. Попробуйте снова.'}
                </Text>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: pending || (titleIsBlank && !createdTask), busy: pending }}
                disabled={pending || (titleIsBlank && !createdTask)}
                style={[styles.button, (pending || (titleIsBlank && !createdTask)) && styles.buttonDisabled]}
                onPress={handleSubmit}
              >
                <Text style={styles.buttonText}>
                  {pending ? 'Сохраняем…' : createdTask ? 'Завершить переход' : 'Добавить на сейчас'}
                </Text>
              </Pressable>
              {!createdTask && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: pending, busy: pending }}
                  disabled={pending}
                  style={styles.secondaryButton}
                  onPress={handleSkip}
                >
                  <Text style={styles.secondaryButtonText}>Пока пропустить</Text>
                </Pressable>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 40 },
  emoji: { fontSize: 64, marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 16 },
  description: { fontSize: 16, color: '#6B7280', textAlign: 'center', lineHeight: 24, marginBottom: 16 },
  form: { width: '100%', marginTop: 16, marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { width: '100%', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: '#111827', backgroundColor: '#FFFFFF' },
  button: { backgroundColor: '#6B5BFC', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12, marginTop: 16, width: '100%', alignItems: 'center' },
  buttonDisabled: { backgroundColor: '#D1D5DB' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  secondaryButton: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 16 },
  secondaryButtonText: { color: '#6B7280', fontSize: 15 },
  error: { width: '100%', color: '#9B2C2C', backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, lineHeight: 20, marginTop: 8 },
  saved: { width: '100%', color: '#276749', backgroundColor: '#F0FFF4', borderRadius: 10, padding: 12, lineHeight: 20, marginTop: 8 },
});
