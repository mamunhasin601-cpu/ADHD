import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

/**
 * Раньше здесь был просто <Slot />. Заменено на <Stack>, чтобы можно было
 * зарегистрировать task-form как модальный экран (presentation: 'modal') —
 * поверх таб-навигации, с нормальным заголовком и кнопкой закрытия.
 */
export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }}>
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
