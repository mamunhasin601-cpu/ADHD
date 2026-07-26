import { Slot } from 'expo-router';
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
 * Корневой layout — раньше отсутствовал (был только app/(tabs)/_layout.tsx),
 * поэтому QueryClientProvider нигде не был подключён. Добавлен здесь, а не в
 * (tabs)/_layout.tsx, чтобы react-query был доступен и вне таб-группы (например,
 * на будущих модальных экранах создания/редактирования задачи).
 */
export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Slot />
    </QueryClientProvider>
  );
}
