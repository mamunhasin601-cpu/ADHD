import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../stores/auth.store';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiClient } from '../lib/api-client';

// Настройка обработки уведомлений
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export default function RootLayout() {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const user = useAuthStore((s) => s.user);

  // Восстанавливаем сессию из SecureStore один раз при старте приложения
  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // Регистрация push-токена после успешной авторизации
  useEffect(() => {
    if (!user) return;

    const registerPushToken = async () => {
      try {
        // Запрос разрешения на уведомления
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          console.log('Push notifications permission denied');
          return;
        }

        // Получение Expo Push Token (без projectId для локальной разработки)
        const tokenData = await Notifications.getExpoPushTokenAsync();
        const token = tokenData.data;

        // Отправка токена на backend
        await apiClient.patch('/users/me', { expoPushToken: token });
        console.log('Push token registered:', token);
      } catch (error) {
        console.error('Failed to register push token:', error);
      }
    };

    registerPushToken();
  }, [user]);

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="task-form"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: 'Задача',
          }}
        />
      </Stack>
    </QueryClientProvider>
  );
}
