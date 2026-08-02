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

            queryClient.setQueryData<Task[]>(tasksKey(dateParam), (old: Task[] | undefined) =>
        old?.map((t: Task) =>
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

export function useDeleteTask(date: Date) {
  const queryClient = useQueryClient();
  const dateParam = toDateParam(date);

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksKey(dateParam) });
    },
  });
}

/**
 * Создание подзадачи — обычный POST /tasks с parentTaskId, но не через useMutation,
 * потому что при сохранении формы нужно последовательно создать несколько подзадач
 * и дождаться каждой (await в цикле), а не просто дёрнуть мутацию из компонента.
 * Инвалидацию кэша вызывающий код делает сам после того, как все подзадачи созданы.
 */
export async function createSubtask(parentTaskId: string, title: string): Promise<Task> {
  const { data } = await apiClient.post<Task>('/tasks', { title, parentTaskId });
  return data;
}

export async function deleteTaskById(id: string): Promise<void> {
  await apiClient.delete(`/tasks/${id}`);
}
