import { TasksService } from './tasks.service';

function setup(failure?: 'insert' | 'boundary') {
  let templates: any[] = []; let occurrences: any[] = []; const events: string[] = [];
  const task: any = {
    create: jest.fn(({ data }: any) => {
      const row = { id: data.isRecurring ? 'series' : 'ordinary', ...data, completedAt: null, startedAt: null, subTasks: [] };
      templates.push(row); events.push(`create:${row.id}`); return Promise.resolve(row);
    }),
    createMany: jest.fn(({ data }: any) => {
      events.push('insert-projection');
      if (failure === 'insert') return Promise.reject(new Error('projection failed'));
      occurrences.push(...data.map((row: any) => ({ ...row, completedAt: null, startedAt: null })));
      return Promise.resolve({ count: data.length });
    }),
    update: jest.fn(({ where, data }: any) => {
      events.push('update-boundary');
      if (failure === 'boundary') return Promise.reject(new Error('boundary failed'));
      const index = templates.findIndex((row) => row.id === where.id); templates[index] = { ...templates[index], ...data };
      return Promise.resolve(templates[index]);
    }),
    findMany: jest.fn(({ where }: any) => {
      const rows = occurrences.filter((row) => !where?.id?.in || where.id.in.includes(row.id));
      return Promise.resolve(rows.map((row) => where?.select?.id ? { id: row.id } : row));
    }),
  };
  const prisma: any = { task, user: { findUnique: jest.fn().mockResolvedValue({ timezone: 'Europe/Moscow' }) } };
  prisma.$transaction = jest.fn(async (callback: any) => {
    const oldTemplates = structuredClone(templates); const oldOccurrences = structuredClone(occurrences);
    events.push('transaction:start');
    try { const result = await callback(prisma); events.push('transaction:commit'); return result; }
    catch (error) { templates = oldTemplates; occurrences = oldOccurrences; events.push('transaction:rollback'); throw error; }
  });
  const notifications = {
    scheduleTaskReminder: jest.fn((task: any) => { events.push(`reminder:${task.id}`); return Promise.resolve(); }),
    cancelTaskReminder: jest.fn(),
  };
  const plan = { enforceTaskLimit: jest.fn().mockResolvedValue(undefined) };
  const service = new TasksService(prisma, notifications as any, plan as any);
  return { service, prisma, notifications, plan, events, templates: () => templates, occurrences: () => occurrences };
}

const recurringDto = { title: 'Daily', startTime: '2026-08-15T06:00:00Z', isRecurring: true,
  recurrenceRule: 'FREQ=DAILY', deviceTimezone: 'Europe/Moscow' } as const;

describe('TasksService.create recurring transaction', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-08-15T10:00:00Z')));
  afterEach(() => jest.useRealTimers());

  it('commits one template, its bounded projection, and returns inserted UUIDs', async () => {
    const h = setup(); const result = await h.service.create('owner', recurringDto as any);
    expect(h.templates()).toHaveLength(1); expect(h.occurrences()).toHaveLength(61);
    expect(h.templates()[0]).toMatchObject({ recurrenceTimezone: 'Europe/Moscow', recurrenceDateKey: '2026-08-15', recurrenceGeneratedThrough: '2026-10-14' });
    expect(result.newOccurrenceIds).toEqual(h.occurrences().map((row) => row.id));
    expect(new Set(result.newOccurrenceIds).size).toBe(61);
  });

  it('runs concrete reminder effects only after commit and never for the template', async () => {
    const h = setup(); await h.service.create('owner', recurringDto as any);
    const commit = h.events.indexOf('transaction:commit'); const firstReminder = h.events.findIndex((event) => event.startsWith('reminder:'));
    expect(firstReminder).toBeGreaterThan(commit);
    expect(h.notifications.scheduleTaskReminder).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'series' }));
  });

  it('rolls back the template and all state when projection insertion fails, with no reminder effects', async () => {
    const h = setup('insert'); await expect(h.service.create('owner', recurringDto as any)).rejects.toThrow('projection failed');
    expect(h.templates()).toEqual([]); expect(h.occurrences()).toEqual([]);
    expect(h.notifications.scheduleTaskReminder).not.toHaveBeenCalled();
    expect(h.plan.enforceTaskLimit).toHaveBeenCalledTimes(1); // no hidden row remains to consume the slot
  });

  it('rolls back inserted occurrences and generated boundary when the boundary update fails', async () => {
    const h = setup('boundary'); await expect(h.service.create('owner', recurringDto as any)).rejects.toThrow('boundary failed');
    expect(h.templates()).toEqual([]); expect(h.occurrences()).toEqual([]);
    expect(h.notifications.scheduleTaskReminder).not.toHaveBeenCalled();
  });

  it('retains the ordinary non-recurring create and reminder path without a transaction', async () => {
    const h = setup(); const result = await h.service.create('owner', { title: 'One', startTime: '2026-08-16T06:00:00Z' });
    expect(result.id).toBe('ordinary'); expect(h.prisma.$transaction).not.toHaveBeenCalled();
    expect(h.notifications.scheduleTaskReminder).toHaveBeenCalledWith(expect.objectContaining({ id: 'ordinary' }));
  });
});
