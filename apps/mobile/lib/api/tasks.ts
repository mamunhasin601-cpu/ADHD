import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api-client';
import type { Task, CreateTaskDto, UpdateTaskDto } from '@focus/shared-types';

function toDateParam(date: Date): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

const tasksKey = (dateParam: string) => ['tasks', dateParam] as const;

export function useTasksForDate(date: Date) {
  const dateParam = toDateParam(date);
  return useQuery({
    queryKey: tasksKey(dateParam),
    queryFn: async () => {
      const { data } = await apiClient.get<Task[]>('/tasks', {
        params: { date: dateParam, includeSubTasks: true },
      });
      return data;
    },
  });
}

export function useCreateTask(date: Date) {
  const queryClient = useQueryClient();
  const dateParam = toDateParam(date);

  return useMutation({
    mutationFn: async (dto: CreateTaskDto) => {
      const { data } = await apiClient.post<Task>('/tasks', dto);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksKey(dateParam) });
    },
  });
}

export function useUpdateTask(date: Date) {
  const queryClient = useQueryClient();
  const dateParam = toDateParam(date);

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateTaskDto }) => {
      const { data } = await apiClient.patch<Task>(`/tasks/${id}`, dto);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksKey(dateParam) });
    },
  });
}

/**
 * Тоггл "готово/не готово" — с оптимистичным апдейтом.
 * Для ADHD-аудитории отклик должен быть мгновенным, ждать ответа сервера нельзя.
 */
export function useToggleTask(date: Date) {
  const queryClient = useQueryClient();
  const dateParam = toDateParam(date);

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch<Task>(`/tasks/${id}/toggle`);
      return data;
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: tasksKey(dateParam) });
      const previous = queryClient.getQueryData<Task[]>(tasksKey(dateParam));

      queryClient.setQueryData<Task[]>(tasksKey(dateParam), (old) =>
        old?.map((t) =>
          t.id === id ? { ...t, completedAt: t.completedAt ? null : new Date() } : t,
        ),
      );

      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(tasksKey(dateParam), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tasksKey(dateParam) });
    },
  });
}
