/**
 * Тесты Inbox mobile-пути — реальные хуки из production-кода.
 *
 * Импортирует useInboxTasks и useToggleInboxTask из ../api/tasks
 * (production-код), а не из локальных копий.
 *
 * Подход: мокаем @tanstack/react-query и ../api-client,
 * вызываем реальные хуки и проверяем что они передали в useQuery/useMutation.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Module-level mocks — объявляются до импортов
// ─────────────────────────────────────────────────────────────────────────────

const mockQueryClient = {
  cancelQueries: jest.fn().mockResolvedValue(undefined),
  getQueryData: jest.fn().mockReturnValue(undefined),
  setQueryData: jest.fn(),
  invalidateQueries: jest.fn(),
};

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(),
  useQueryClient: jest.fn(() => mockQueryClient),
}));

jest.mock('../api-client', () => ({
  apiClient: {
    get: jest.fn(),
    patch: jest.fn(),
  },
}));

// Импорты после mock-деклараций
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../api-client';
import { useInboxTasks, useToggleInboxTask, useRescheduleOverdueTasks } from '../api/tasks';

const mockUseQuery = useQuery as jest.MockedFunction<typeof useQuery>;
const mockUseMutation = useMutation as jest.MockedFunction<typeof useMutation>;
const mockApiGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;
const mockApiPatch = apiClient.patch as jest.MockedFunction<typeof apiClient.patch>;

// ─────────────────────────────────────────────────────────────────────────────
// 1. useInboxTasks — cache key и queryFn
// ─────────────────────────────────────────────────────────────────────────────

describe('useInboxTasks (production hook)', () => {
  let capturedConfig: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseQuery.mockImplementation((config: any) => {
      capturedConfig = config;
      return { data: undefined, isLoading: false, isError: false, refetch: jest.fn() } as any;
    });
  });

  it("использует queryKey ['tasks', 'inbox']", () => {
    useInboxTasks();
    expect(capturedConfig.queryKey).toEqual(['tasks', 'inbox']);
  });

  it('queryFn вызывает GET /tasks с inbox=true и includeSubTasks=true', async () => {
    const inboxTask = { id: 'task-1', startTime: null };
    mockApiGet.mockResolvedValue({ data: [inboxTask] } as any);

    useInboxTasks();
    const result = await capturedConfig.queryFn();

    expect(mockApiGet).toHaveBeenCalledWith('/tasks', {
      params: { inbox: true, includeSubTasks: true },
    });
    expect(result).toEqual([inboxTask]);
  });

  it('queryFn не передаёт параметр date', async () => {
    mockApiGet.mockResolvedValue({ data: [] } as any);

    useInboxTasks();
    await capturedConfig.queryFn();

    expect(mockApiGet).not.toHaveBeenCalledWith(
      '/tasks',
      expect.objectContaining({ params: expect.objectContaining({ date: expect.anything() }) }),
    );
  });

  it('queryFn возвращает пустой массив для пустого Inbox', async () => {
    mockApiGet.mockResolvedValue({ data: [] } as any);

    useInboxTasks();
    const result = await capturedConfig.queryFn();

    expect(result).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. useToggleInboxTask — cache key, optimistic update, rollback, invalidation
// ─────────────────────────────────────────────────────────────────────────────

describe('useToggleInboxTask (production hook)', () => {
  let capturedMutationConfig: any;

  const inboxTask = {
    id: 'task-inbox-1',
    title: 'Задача',
    startTime: null,
    completedAt: null,
  startedAt: null,
    color: '#6B5BFC',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMutation.mockImplementation((config: any) => {
      capturedMutationConfig = config;
      return { mutate: jest.fn(), isPending: false } as any;
    });
    mockQueryClient.getQueryData.mockReturnValue([inboxTask]);
  });

  it('mutationFn вызывает PATCH /tasks/:id/toggle', async () => {
    const updatedTask = { ...inboxTask, completedAt: new Date() };
    mockApiPatch.mockResolvedValue({ data: updatedTask } as any);

    useToggleInboxTask();
    const result = await capturedMutationConfig.mutationFn(inboxTask.id);

    expect(mockApiPatch).toHaveBeenCalledWith(`/tasks/${inboxTask.id}/toggle`);
    expect(result).toEqual(updatedTask);
  });

  it('onMutate отменяет запросы по inboxKey и применяет optimistic update', async () => {
    useToggleInboxTask();
    await capturedMutationConfig.onMutate(inboxTask.id);

    expect(mockQueryClient.cancelQueries).toHaveBeenCalledWith({
      queryKey: ['tasks', 'inbox'],
    });
    expect(mockQueryClient.setQueryData).toHaveBeenCalledWith(
      ['tasks', 'inbox'],
      expect.any(Function),
    );
  });

  it('optimistic updater переключает completedAt для совпадающего id', async () => {
    useToggleInboxTask();
    await capturedMutationConfig.onMutate(inboxTask.id);

    // Извлекаем updater-функцию из setQueryData и проверяем результат
    const updaterFn = mockQueryClient.setQueryData.mock.calls[0][1];
    const prev = [inboxTask];
    const next = updaterFn(prev);

    expect(next[0].completedAt).toBeTruthy(); // было null → стало Date
  });

  it('optimistic updater не трогает другие задачи', async () => {
    const otherTask = { ...inboxTask, id: 'other-task', completedAt: null };

    useToggleInboxTask();
    await capturedMutationConfig.onMutate(inboxTask.id);

    const updaterFn = mockQueryClient.setQueryData.mock.calls[0][1];
    const prev = [inboxTask, otherTask];
    const next = updaterFn(prev);

    expect(next[1].completedAt).toBeNull(); // другая задача не изменена
  });

  it('onError откатывает previous из context', async () => {
    const previousTasks = [inboxTask];
    const context = { previous: previousTasks };

    useToggleInboxTask();
    capturedMutationConfig.onError(new Error('network'), inboxTask.id, context);

    expect(mockQueryClient.setQueryData).toHaveBeenCalledWith(
      ['tasks', 'inbox'],
      previousTasks,
    );
  });

  it('onError без context не падает', () => {
    useToggleInboxTask();
    expect(() =>
      capturedMutationConfig.onError(new Error('network'), inboxTask.id, undefined),
    ).not.toThrow();
  });

  it('onSettled инвалидирует inboxKey', () => {
    useToggleInboxTask();
    capturedMutationConfig.onSettled();

    expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['tasks', 'inbox'],
    });
  });

  it('onSettled не инвалидирует dated Today key', () => {
    useToggleInboxTask();
    capturedMutationConfig.onSettled();

    // Убеждаемся что инвалидируется только inboxKey, а не ['tasks', '2026-08-04']
    const calls = mockQueryClient.invalidateQueries.mock.calls;
    const invalidatedKeys = calls.map((c: any[]) => c[0].queryKey);
    const hasDateKey = invalidatedKeys.some(
      (k: string[]) => k.length === 2 && k[0] === 'tasks' && k[1] !== 'inbox',
    );
    expect(hasDateKey).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Recovery → Inbox cache invalidation (через реальный useRescheduleOverdueTasks)
// ─────────────────────────────────────────────────────────────────────────────

describe('useRescheduleOverdueTasks инвалидирует Inbox при null destination', () => {
  let capturedMutationConfig: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMutation.mockImplementation((config: any) => {
      capturedMutationConfig = config;
      return { mutate: jest.fn(), isPending: false } as any;
    });
  });

  it('onSuccess с null → инвалидирует inboxKey', async () => {
    useRescheduleOverdueTasks(new Date('2026-08-04'));

    const variables = {
      items: [{ taskId: 'task-1', targetStartTime: null }],
    };
    capturedMutationConfig.onSuccess({}, variables);

    const calls = mockQueryClient.invalidateQueries.mock.calls;
    const invalidatedKeys = calls.map((c: any[]) => c[0].queryKey);
    expect(invalidatedKeys).toContainEqual(['tasks', 'inbox']);
  });

  it('onSuccess без null → НЕ инвалидирует inboxKey', async () => {
    useRescheduleOverdueTasks(new Date('2026-08-04'));

    const variables = {
      items: [{ taskId: 'task-1', targetStartTime: '2026-08-05T10:00:00.000Z' }],
    };
    capturedMutationConfig.onSuccess({}, variables);

    const calls = mockQueryClient.invalidateQueries.mock.calls;
    const invalidatedKeys = calls.map((c: any[]) => c[0].queryKey);
    expect(invalidatedKeys).not.toContainEqual(['tasks', 'inbox']);
  });
});
