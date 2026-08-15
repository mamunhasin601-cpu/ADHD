import { BadRequestException } from '@nestjs/common';
import { formatInTimeZone } from 'date-fns-tz';
import { TasksService } from './tasks.service';
import { validate } from 'class-validator';
import { CreateTaskDto } from './dto/create-task.dto';

const series = (rule = 'FREQ=DAILY', zone = 'America/New_York') => ({
  id: 'series-1', userId: 'owner', title: 'Repeat', firstStep: null,
  startTime: new Date('2026-03-07T14:15:00.000Z'), durationMinutes: 25,
  color: '#6B5BFC', isRecurring: true, recurrenceRule: rule,
  recurrenceTimezone: zone, recurrenceDateKey: '2026-03-07',
  parentTaskId: null, completedAt: null, startedAt: null,
});

function setup(value = series()) {
  const created: any[] = [];
  const prisma: any = {
    task: {
      findUnique: jest.fn().mockResolvedValue(value),
      createMany: jest.fn(({ data }: any) => { created.push(...data); return Promise.resolve({ count: data.length }); }),
      update: jest.fn().mockResolvedValue(value),
      findMany: jest.fn().mockImplementation(() => Promise.resolve(created.map((x, i) => ({ ...x, id: `occ-${i}`, completedAt: null, startedAt: null })))),
      updateMany: jest.fn(), deleteMany: jest.fn(),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ timezone: value.recurrenceTimezone }) },
  };
  const notifications: any = { scheduleTaskReminder: jest.fn(), cancelTaskReminder: jest.fn() };
  return { service: new TasksService(prisma, notifications, { enforceTaskLimit: jest.fn() } as any), prisma, created, notifications };
}

describe('TasksService basic recurrence', () => {
  it('projects daily calendar identities with stable local wall time across spring DST and month boundaries', async () => {
    const { service, created } = setup();
    await service.extendSeries('owner', 'series-1');
    const march8 = created.find((x) => x.recurrenceDateKey === '2026-03-08');
    expect(formatInTimeZone(march8.startTime, 'America/New_York', 'yyyy-MM-dd HH:mm')).toBe('2026-03-08 09:15');
    expect(created.some((x) => x.recurrenceDateKey === '2026-04-01')).toBe(true);
    expect(created.map((x) => `${x.seriesId}:${x.recurrenceDateKey}`)).toEqual(expect.arrayContaining(['series-1:2026-03-08']));
  });

  it('keeps fall-back and Moscow wall times, and weekdays exclude weekends', async () => {
    const fall = series('FREQ=DAILY', 'America/New_York');
    fall.startTime = new Date('2026-10-31T13:15:00Z'); fall.recurrenceDateKey = '2026-10-31';
    let harness = setup(fall); await harness.service.extendSeries('owner', fall.id);
    expect(formatInTimeZone(harness.created.find(x => x.recurrenceDateKey === '2026-11-01').startTime, fall.recurrenceTimezone, 'HH:mm')).toBe('09:15');
    const moscow = series('FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR', 'Europe/Moscow');
    moscow.startTime = new Date('2026-12-31T06:15:00Z'); moscow.recurrenceDateKey = '2026-12-31';
    harness = setup(moscow); await harness.service.extendSeries('owner', moscow.id);
    expect(harness.created.some(x => x.recurrenceDateKey === '2027-01-01')).toBe(true);
    expect(harness.created.some(x => x.recurrenceDateKey === '2027-01-02')).toBe(false);
    expect(formatInTimeZone(harness.created[0].startTime, 'Europe/Moscow', 'HH:mm')).toBe('09:15');
  });

  it('uses createMany skipDuplicates as the concurrency-safe idempotency boundary and schedules concrete reminders', async () => {
    const { service, prisma, notifications } = setup();
    await service.extendSeries('owner', 'series-1');
    expect(prisma.task.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
    expect(notifications.scheduleTaskReminder).toHaveBeenCalledWith(expect.objectContaining({ seriesId: 'series-1' }));
  });

  it('rejects arbitrary rules and prevents acting on a series template', async () => {
    const bad = setup(series('FREQ=WEEKLY;BYDAY=SU'));
    await expect(bad.service.extendSeries('owner', 'series-1')).rejects.toBeInstanceOf(BadRequestException);
    const normal = setup();
    await expect(normal.service.start('owner', 'series-1')).rejects.toBeInstanceOf(BadRequestException);
    await expect(normal.service.toggleComplete('owner', 'series-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid recurrence flag/rule/anchor combinations during DTO validation', async () => {
    const dto = Object.assign(new CreateTaskDto(), { title: 'Invalid', isRecurring: true, recurrenceRule: 'FREQ=DAILY' });
    expect(await validate(dto)).not.toHaveLength(0);
    const mismatched = Object.assign(new CreateTaskDto(), { title: 'Invalid', isRecurring: false, recurrenceRule: 'FREQ=DAILY' });
    expect(await validate(mismatched)).not.toHaveLength(0);
  });
});
