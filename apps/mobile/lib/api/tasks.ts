import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api-client';
import { toCanonicalDateParam } from '../timezone';
import {
  scheduleLocalReminder,
  cancelLocalReminder,
  getLocalOnlyMode,
} from '../local-notifications';
import type {
  Task,
  CreateTaskDto,
  UpdateTaskDto,
  OverdueTasksResponse,
  RescheduleRecoveryRequest,
  RescheduleRecoveryResponse,
} from '@focus/shared-types';

/**
 * ONE canonical date key for every hook that refers to the same server day
 * (Task 0007A finding 1).
 *
 * Previously the dated Today hooks used `toISOString().slice(0, 10)` (a UTC
 * date) while Recovery used the profile-timezone date. Those are different
 * calendar days around midnight and whenever device tz != profile tz, so Today
 * could request/invalidate a different key than Recovery and display the wrong
 * day's tasks. `toCanonicalDateParam` is now the single source for both.
 */
function toDateParam(date: Date, userTimezone?: string | null): string {
  return toCanonicalDateParam(date, userTimezone);
}

const tasksKey = (dateParam: string) => ['tasks', dateParam] as const;
const recoveryKey = (dateParam: string) => ['tasks', 'recovery', dateParam] as const;
const inboxKey = () => ['tasks', 'inbox'] as const;

/** Explicit start command. The returned server timestamp is the only canonical value. */
export function useStartTask(date: Date, userTimezone?: string | null) {
  const queryClient = useQueryClient();
  const dateParam = toDateParam(date, userTimezone);
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch<Task>(`/tasks/${id}/start`);
      return data;
    },
    onSuccess: (task) => {
      queryClient.setQueryData<Task[]>(tasksKey(dateParam), (old) =>
        old?.map((item) => item.id === task.id ? task : item),
      );
      cancelLocalReminder(task.id).catch(() => {});
    },
    onError: (error: unknown) => {
      if ((error as { response?: { status?: number } }).response?.status === 409) {
        queryClient.invalidateQueries({ queryKey: tasksKey(dateParam) });
      }
    },
  });
}

/**
 * Today's dated task list.
 *
 * `userTimezone` is the profile IANA timezone. Passing it makes the query key
 * and the `?date=` param resolve to the user's calendar day — the same day the
 * server computes and the same key Recovery invalidates (Task 0007A).
 */
export function useTasksForDate(date: Date, userTimezone?: string | null) {
  const dateParam = toDateParam(date, userTimezone);
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

export function useCreateTask(date: Date, userTimezone?: string | null) {
  const queryClient = useQueryClient();
  const dateParam = toDateParam(date, userTimezone);

  return useMutation({
    mutationFn: async (dto: CreateTaskDto) => {
      const { data } = await apiClient.post<Task>('/tasks', dto);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: tasksKey(dateParam) });
      // Secondary effect: schedule local reminder for tasks with a future start time.
      // Respects channel policy (localOnly=false when push is active → no-op).
      // .catch() ensures CRUD result is never affected by reminder failures.
      if (data.startTime && !data.completedAt && !data.startedAt) {
        scheduleLocalReminder(data, getLocalOnlyMode()).catch(() => {});
      }
    },
  });
}

export function useUpdateTask(date: Date, userTimezone?: string | null) {
  const queryClient = useQueryClient();
  const dateParam = toDateParam(date, userTimezone);

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateTaskDto }) => {
      const { data } = await apiClient.patch<Task>(`/tasks/${id}`, dto);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: tasksKey(dateParam) });
      // Reschedule or cancel based on updated task state.
      if (data.startTime && !data.completedAt && !data.startedAt) {
        scheduleLocalReminder(data, getLocalOnlyMode()).catch(() => {});
      } else {
        cancelLocalReminder(data.id).catch(() => {});
      }
    },
  });
}

/**
 * Тоггл "готово/не готово" — с оптимистичным апдейтом.
 * Для ADHD-аудитории отклик должен быть мгновенным, ждать ответа сервера нельзя.
 */
export function useToggleTask(date: Date, userTimezone?: string | null) {
  const queryClient = useQueryClient();
  const dateParam = toDateParam(date, userTimezone);

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
    onSuccess: (data) => {
      // Secondary effect: cancel reminder when completed; reschedule when uncompleted.
      if (data.completedAt) {
        cancelLocalReminder(data.id).catch(() => {});
      } else if (data.startTime && !data.startedAt) {
        scheduleLocalReminder(data, getLocalOnlyMode()).catch(() => {});
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tasksKey(dateParam) });
    },
  });
}

export function useDeleteTask(date: Date, userTimezone?: string | null) {
  const queryClient = useQueryClient();
  const dateParam = toDateParam(date, userTimezone);

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/tasks/${id}`);
    },
    onSuccess: async (_data, id) => {
      queryClient.setQueryData<Task[]>(tasksKey(dateParam), (old) =>
        old?.filter((task) => task.id !== id),
      );
      await queryClient.invalidateQueries({ queryKey: tasksKey(dateParam) });
      // Cancel local reminder for the deleted task.
      cancelLocalReminder(id).catch(() => {});
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

//─────────────────────────────────────────────────────────────────────────
// Inbox hook — unscheduled root tasks (startTime IS NULL)
// Cache key: ['tasks', 'inbox'] — invalidated by recovery reschedule success
// ─────────────────────────────────────────────────────────────────────────

/**
 * Возвращает root-задачи без startTime (Inbox).
 * Использует тот же inboxKey, который инвалидируется при успешном reschedule
 * с targetStartTime: null (useRescheduleOverdueTasks onSuccess).
 */
export function useInboxTasks() {
  return useQuery({
    queryKey: inboxKey(),
    queryFn: async (): Promise<Task[]> => {
      const { data } = await apiClient.get<Task[]>('/tasks', {
        params: { inbox: true, includeSubTasks: true },
      });
      return data;
    },
  });
}

/**
 * Toggle "готово / не готово" для задач Inbox.
 * Оптимистично обновляет ['tasks', 'inbox'] — не ['tasks', '1970-01-01'].
 * После settle инвалидирует inboxKey для согласования с сервером.
 */
export function useToggleInboxTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch<Task>(`/tasks/${id}/toggle`);
      return data;
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: inboxKey() });
      const previous = queryClient.getQueryData<Task[]>(inboxKey());
      queryClient.setQueryData<Task[]>(inboxKey(), (old: Task[] | undefined) =>
        old?.map((t: Task) =>
          t.id === id ? { ...t, completedAt: t.completedAt ? null : new Date() } : t,
        ),
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(inboxKey(), context.previous);
      }
    },
    onSuccess: (data) => {
      // Inbox tasks have no startTime, but cancel any stale reminder just in case.
      if (data.completedAt) {
        cancelLocalReminder(data.id).catch(() => {});
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: inboxKey() });
    },
  });
}

//─────────────────────────────────────────────────────────────────────────
// Recovery hooks (Guilt-Free Return)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Возвращает просроченные задачи пользователя для recovery flow.
 *
 * userTimezone — IANA timezone из профиля. Ключ строится тем же каноническим
 * хелпером, что и Today (Task 0007A), поэтому device/profile mismatch не может
 * развести Today и Recovery по разным календарным дням.
 *
 * Вызывающий код обязан передавать `enabled: false`, если профильная timezone
 * отсутствует или невалидна — Recovery не читает и не пишет без неё.
 */
export function useOverdueTasks(
  date: Date,
  enabled: boolean,
  userTimezone?: string | null,
) {
  const dateParam = toDateParam(date, userTimezone);
  return useQuery({
    queryKey: recoveryKey(dateParam),
    queryFn: async(): Promise<OverdueTasksResponse> => {
      const { data } = await apiClient.get<OverdueTasksResponse>('/tasks/recovery', {
        params: { date: dateParam },
      });
      return data;
    },
    enabled,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Мутация для подтверждения reschedule выбранных просроченных задач.
 *
 * Инвалидация использует тот же канонический date key, что и Today-запрос
 * (Task 0007A), поэтому успешный перенос гарантированно обновляет именно тот
 * кэш, из которого Today читает.
 */
export function useRescheduleOverdueTasks(date: Date, userTimezone?: string | null) {
  const queryClient = useQueryClient();
  const dateParam = toDateParam(date, userTimezone);

  return useMutation({
    mutationFn: async (dto: RescheduleRecoveryRequest): Promise<RescheduleRecoveryResponse> => {
      const { data } = await apiClient.post<RescheduleRecoveryResponse>(
        '/tasks/recovery/reschedule',
        dto,
      );
      return data;
    },
    onSuccess: (data, variables) => {
      // Инвалидируем recovery list
      queryClient.invalidateQueries({ queryKey: recoveryKey(dateParam) });
      // Инвалидируем Today
      queryClient.invalidateQueries({ queryKey: tasksKey(dateParam) });
      // Инвалидируем Inbox если кто-то переносился туда (targetStartTime: null)
      const hasInboxMove = variables.items.some((item) => item.targetStartTime === null);
      if (hasInboxMove) {
        queryClient.invalidateQueries({ queryKey: inboxKey() });
      }
      // Secondary effect: update local reminders for rescheduled tasks.
      // For items moved to inbox (null target) → cancel.
      // For items with a new start time → reschedule using a synthetic task object.
      // scheduleLocalReminder only needs task.id and task.startTime.
      for (const item of variables.items) {
        if (item.targetStartTime === null) {
          cancelLocalReminder(item.taskId).catch(() => {});
        } else {
          const syntheticTask = {
            id: item.taskId,
            startTime: new Date(item.targetStartTime),
          } as unknown as Task;
          scheduleLocalReminder(syntheticTask, getLocalOnlyMode()).catch(() => {});
        }
      }
    },
    onError: (error: unknown) => {
      // При409 (stale state) инвалидируем recovery для re-fetch
      const axiosError = error as { response?: { status: number } };
      if (axiosError.response?.status === 409) {
        queryClient.invalidateQueries({ queryKey: recoveryKey(dateParam) });
      }
      // Прочие ошибки — предыдущее состояние экрана остаётся intact
    },
  });
}
