import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useCreateTask } from '../lib/api/tasks';
import { apiClient } from '../lib/api-client';
import { useAuthStore } from '../stores/auth.store';
import {
  isValidIANATimezone,
  localDateTimeToInstant,
  toCanonicalDateParam,
} from '../lib/timezone';
import type { User } from '@focus/shared-types';
import { formatWallClock, parseClockInput, uses12HourClock } from '../lib/time-format';

/**
 * 5-minute start onboarding.
 * Проводит нового пользователя через:
 * 1. Приветствие
 * 2. Создание первой задачи
 * 3. Объяснение основных концепций
 * 4. Переход на Today screen
 */
export default function OnboardingScreen() {
  const setUser = useAuthStore((s) => s.setUser);
  const profileTimezone = useAuthStore((s) => s.user?.timezone);
  const timeFormat = useAuthStore((s) => s.user?.timeFormat ?? 'SYSTEM');
  const [step, setStep] = useState(1);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskTime, setTaskTime] = useState('');
  const createTask = useCreateTask(new Date(), profileTimezone);

  async function completeOnboarding() {
    try {
      // Отмечаем онбординг как завершенный
      const { data: updatedUser } = await apiClient.patch<User>('/users/me', {
        hasCompletedOnboarding: true,
      });
      setUser(updatedUser);
    } catch {
      Alert.alert(
        'Не удалось завершить онбординг',
        'Проверьте соединение и попробуйте снова',
      );
    }
  }

  function handleCreateFirstTask() {
    if (!taskTitle.trim()) return;

    const now = new Date();
    let startTime: Date | null = null;

    if (taskTime) {
      const parsed = parseClockInput(taskTime, timeFormat);
      if (!parsed) { Alert.alert('Проверьте время', uses12HourClock(timeFormat) ? 'Введите время в формате 2:30 PM' : 'Введите время в формате 14:30'); return; }
      const { hours, minutes } = parsed;
      if (profileTimezone && isValidIANATimezone(profileTimezone)) {
        startTime = localDateTimeToInstant(
          toCanonicalDateParam(now, profileTimezone),
          hours,
          minutes,
          profileTimezone,
        );
      } else {
        startTime = new Date(now);
        startTime.setHours(hours, minutes, 0, 0);
      }
    }

    createTask.mutate(
      {
        title: taskTitle.trim(),
        startTime: startTime?.toISOString() || null,
        durationMinutes: 30,
      },
      {
        onSuccess: () => setStep(3),
      },
    );
  }

  if (step === 1) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />
        <View style={styles.content}>
          <Text style={styles.emoji}>👋</Text>
          <Text style={styles.title}>Добро пожаловать в Focus</Text>
          <Text style={styles.description}>
            Focus помогает людям с ADHD планировать день так, чтобы ничего не забыть и не
            выгореть.
          </Text>
          <Text style={styles.description}>
            Мы покажем основы за 5 минут. Начнём?  
          </Text>
          <Pressable style={styles.button} onPress={() => setStep(2)}>
            <Text style={styles.buttonText}>Начать</Text>
          </Pressable>
          <Pressable style={styles.skipButton} onPress={completeOnboarding}>
            <Text style={styles.skipButtonText}>Пропустить</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 2) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.emoji}>✨</Text>
          <Text style={styles.title}>Создайте первую задачу</Text>
          <Text style={styles.description}>
            Что вы планируете сделать сегодня? Не обязательно что-то важное — начните с простого.
          </Text>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Например: Позвонить маме"
              placeholderTextColor="#9CA3AF"
              value={taskTitle}
              onChangeText={setTaskTitle}
              autoFocus
            />

            <Text style={styles.label}>Во сколько? (опционально)</Text>
            <TextInput
              style={styles.input}
              placeholder={formatWallClock(14, 0, timeFormat)}
              placeholderTextColor="#9CA3AF"
              value={taskTime}
              onChangeText={setTaskTime}
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.hint}>
              Если не укажете время, запись останется в «Мыслях». Запланировать её можно позже.
            </Text>
          </View>

          <Pressable
            style={[styles.button, !taskTitle.trim() && styles.buttonDisabled]}
            onPress={handleCreateFirstTask}
            disabled={!taskTitle.trim() || createTask.isPending}
          >
            <Text style={styles.buttonText}>
              {createTask.isPending ? 'Создаём...' : 'Создать'}
            </Text>
          </Pressable>

          <Pressable style={styles.skipButton} onPress={() => setStep(3)}>
            <Text style={styles.skipButtonText}>Пропустить</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (step === 3) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />
        <View style={styles.content}>
          <Text style={styles.emoji}>🎯</Text>
          <Text style={styles.title}>Вот и всё!</Text>
          <Text style={styles.description}>
            Теперь вы знаете основы. На главном экране вы увидите:
          </Text>

          <View style={styles.featuresList}>
            <View style={styles.feature}>
              <Text style={styles.featureEmoji}>📅</Text>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>Таймлайн</Text>
                <Text style={styles.featureDescription}>
                  Все задачи на день с {formatWallClock(6, 0, timeFormat)} до {formatWallClock(0, 0, timeFormat)}
                </Text>
              </View>
            </View>

            <View style={styles.feature}>
              <Text style={styles.featureEmoji}>⏰</Text>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>Сейчас / Дальше</Text>
                <Text style={styles.featureDescription}>
                  Подсказка, чем заняться прямо сейчас
                </Text>
              </View>
            </View>

            <View style={styles.feature}>
              <Text style={styles.featureEmoji}>📥</Text>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>Мысли</Text>
                <Text style={styles.featureDescription}>
                  Записи, которые пока не нужно планировать
                </Text>
              </View>
            </View>
          </View>

          <Pressable style={styles.button} onPress={completeOnboarding}>
            <Text style={styles.buttonText}>Перейти к планированию</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  emoji: {
    fontSize: 80,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  form: {
    width: '100%',
    marginTop: 24,
    marginBottom: 32,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  hint: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 8,
    lineHeight: 18,
  },
  button: {
    backgroundColor: '#6B5BFC',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 16,
    width: '100%',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    marginTop: 16,
    paddingVertical: 12,
  },
  skipButtonText: {
    color: '#6B7280',
    fontSize: 15,
  },
  featuresList: {
    width: '100%',
    marginTop: 24,
    marginBottom: 32,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  featureEmoji: {
    fontSize: 32,
    marginRight: 16,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
});
