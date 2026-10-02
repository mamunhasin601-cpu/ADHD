import { formatInTimeZone } from 'date-fns-tz';
import { UsersService } from './users.service';

const task = (overrides: Record<string, unknown> = {}) => ({
  id: 'one-off',
  userId: 'u1',
  title: 'Task',
  kind: 'TASK',
  startTime: new Date('2026-09-13T10:45:00Z'),
  durationMinutes: 15,
  color: '#6B5BFC',
  isRecurring: false,
  recurrenceRule: null,
  recurrenceTimezone: null,
  recurrenceDateKey: null,
  recurrenceGeneratedThrough: null,
  recurrenceEndedAt: null,
  seriesId: null,
  parentTaskId: null,
  completedAt: null,
  startedAt: null,
  firstStep: null,
  createdAt: new Date('2026-09-01T00:00:00Z'),
  updatedAt: new Date('2026-09-01T00:00:00Z'),
  ...overrides,
});

function harness(options: {
  timezone: string;
  timezoneSyncedAt: Date | null;
  tasks?: any[];
}) {
  let user: any = {
    id: 'u1', email: 'u@test.dev', phone: null, passwordHash: 'secret',
    timezone: options.timezone, timezoneSyncedAt: options.timezoneSyncedAt,
    timeFormat: 'H24', hasCompletedOnboarding: true, plan: 'FREE',
    proExpiresAt: null, expoPushToken: null, yandexId: null, vkId: null,
    mailruId: null, createdAt: new Date('2026-01-01T00:00:00Z'),
  };
  let rows = structuredClone(options.tasks ?? []);

  const taskStore: any = {
    findMany: jest.fn(({ where }: any) => {
      if (where?.id?.in) return Promise.resolve(rows.filter((row: any) => where.id.in.includes(row.id)));
      return Promise.resolve(rows.filter((row: any) => {
        if (where?.userId && row.userId !== where.userId) return false;
        if (where?.parentTaskId === null && row.parentTaskId !== null) return false;
        if (where?.seriesId === null && row.seriesId !== null) return false;
        if (where?.isRecurring !== undefined && row.isRecurring !== where.isRecurring) return false;
        if (where?.recurrenceEndedAt === null && row.recurrenceEndedAt !== null) return false;
        if (where?.startTime?.not === null && row.startTime === null) return false;
        if (where?.startTime?.gt && row.startTime.getTime() <= where.startTime.gt.getTime()) return false;
        if (where?.startedAt === null && row.startedAt !== null) return false;
        if (where?.completedAt === null && row.completedAt !== null) return false;
        return true;
      }));
    }),
    update: jest.fn(({ where, data }: any) => {
      const index = rows.findIndex((row: any) => row.id === where.id);
      rows[index] = { ...rows[index], ...data };
      return Promise.resolve(rows[index]);
    }),
  };
  const userStore: any = {
    findUnique: jest.fn().mockImplementation(() => Promise.resolve(user)),
    update: jest.fn(({ data }: any) => {
      user = { ...user, ...data };
      return Promise.resolve(user);
    }),
  };
  const prisma: any = { user: userStore, task: taskStore };
  prisma.$transaction = jest.fn(async (callback: (tx: any) => Promise<any>) => {
    const oldUser = structuredClone(user);
    const oldRows = structuredClone(rows);
    try {
      return await callback(prisma);
    } catch (error) {
      user = oldUser;
      rows = oldRows;
      throw error;
    }
  });
  const notifications = {
    scheduleTaskReminder: jest.fn().mockResolvedValue(undefined),
    cancelTaskReminder: jest.fn().mockResolvedValue(undefined),
  };
  const service = new UsersService(prisma, notifications as any);
  return { service, prisma, notifications, user: () => user, rows: () => rows };
}

describe('UsersService smartphone-authoritative timezone sync', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-09-12T06:40:00Z')));
  afterEach(() => jest.useRealTimers());

  it('adopts a legacy profile without guessing or rewriting one-off timestamps', async () => {
    const oneOff = task({ startTime: new Date('2026-09-12T10:45:00Z') });
    const h = harness({ timezone: 'GMT', timezoneSyncedAt: null, tasks: [oneOff] });

    await h.service.syncTimezone('u1', 'Europe/Samara');

    expect(h.user()).toMatchObject({
      timezone: 'Europe/Samara',
      timezoneSyncedAt: new Date('2026-09-12T06:40:00Z'),
    });
    expect(h.rows()[0].startTime).toEqual(new Date('2026-09-12T10:45:00Z'));
    expect(h.notifications.scheduleTaskReminder).not.toHaveBeenCalled();
  });

  it('makes an already synchronised identical timezone a true no-op', async () => {
    const h = harness({
      timezone: 'Europe/Samara',
      timezoneSyncedAt: new Date('2026-09-01T00:00:00Z'),
    });
    const result = await h.service.syncTimezone('u1', 'Europe/Samara');
    expect(result.timezone).toBe('Europe/Samara');
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
    expect(h.prisma.user.update).not.toHaveBeenCalled();
  });

  it('preserves local wall time for future untouched plan rows after a later change', async () => {
    const future = task({ id: 'future', startTime: new Date('2026-09-13T06:00:00Z') });
    const started = task({ id: 'started', startTime: new Date('2026-09-13T07:00:00Z'), startedAt: new Date() });
    const completed = task({ id: 'completed', startTime: new Date('2026-09-13T08:00:00Z'), completedAt: new Date() });
    const h = harness({
      timezone: 'Europe/Samara',
      timezoneSyncedAt: new Date('2026-09-01T00:00:00Z'),
      tasks: [future, started, completed],
    });

    await h.service.syncTimezone('u1', 'America/New_York');

    expect(h.rows().find((row: any) => row.id === 'future').startTime)
      .toEqual(new Date('2026-09-13T14:00:00Z'));
    expect(h.rows().find((row: any) => row.id === 'started').startTime)
      .toEqual(new Date('2026-09-13T07:00:00Z'));
    expect(h.rows().find((row: any) => row.id === 'completed').startTime)
      .toEqual(new Date('2026-09-13T08:00:00Z'));
    expect(h.notifications.scheduleTaskReminder).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'future', startTime: new Date('2026-09-13T14:00:00Z') }),
    );
  });

  it('keeps recurrence UUID/date identity and 10:00 local across New York DST', async () => {
    jest.setSystemTime(new Date('2026-03-06T12:00:00Z'));
    const series = task({
      id: 'series', isRecurring: true, recurrenceRule: 'FREQ=DAILY',
      recurrenceTimezone: 'Europe/Samara', recurrenceDateKey: '2026-03-06',
      recurrenceGeneratedThrough: '2026-05-05', startTime: new Date('2026-03-06T06:00:00Z'),
    });
    const beforeDst = task({
      id: 'occurrence-7', seriesId: 'series', recurrenceRule: 'FREQ=DAILY',
      recurrenceDateKey: '2026-03-07', startTime: new Date('2026-03-07T06:00:00Z'),
    });
    const afterDst = task({
      id: 'occurrence-8', seriesId: 'series', recurrenceRule: 'FREQ=DAILY',
      recurrenceDateKey: '2026-03-08', startTime: new Date('2026-03-08T06:00:00Z'),
    });
    const h = harness({
      timezone: 'Europe/Samara',
      timezoneSyncedAt: new Date('2026-02-01T00:00:00Z'),
      tasks: [series, beforeDst, afterDst],
    });

    await h.service.syncTimezone('u1', 'America/New_York');

    const rows = h.rows();
    const movedSeries = rows.find((row: any) => row.id === 'series');
    const movedBefore = rows.find((row: any) => row.id === 'occurrence-7');
    const movedAfter = rows.find((row: any) => row.id === 'occurrence-8');
    expect(movedSeries).toMatchObject({
      id: 'series', recurrenceTimezone: 'America/New_York', recurrenceDateKey: '2026-03-06',
    });
    expect(movedBefore.id).toBe('occurrence-7');
    expect(movedAfter.id).toBe('occurrence-8');
    expect(formatInTimeZone(movedBefore.startTime, 'America/New_York', 'yyyy-MM-dd HH:mm'))
      .toBe('2026-03-07 10:00');
    expect(formatInTimeZone(movedAfter.startTime, 'America/New_York', 'yyyy-MM-dd HH:mm'))
      .toBe('2026-03-08 10:00');
  });

  it('rolls back profile and task movement together', async () => {
    const future = task({ id: 'future', startTime: new Date('2026-09-13T06:00:00Z') });
    const h = harness({
      timezone: 'Europe/Samara',
      timezoneSyncedAt: new Date('2026-09-01T00:00:00Z'),
      tasks: [future],
    });
    h.prisma.user.update.mockRejectedValueOnce(new Error('write failed'));

    await expect(h.service.syncTimezone('u1', 'America/New_York')).rejects.toThrow('write failed');
    expect(h.user().timezone).toBe('Europe/Samara');
    expect(h.rows()[0].startTime).toEqual(new Date('2026-09-13T06:00:00Z'));
    expect(h.notifications.scheduleTaskReminder).not.toHaveBeenCalled();
  });
});
