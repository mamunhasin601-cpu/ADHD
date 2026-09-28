import { ConflictException } from '@nestjs/common';
import { TasksService } from './tasks.service';

function task(id: string, startTime: string, durationMinutes: number | null, completed = false) {
  return {
    id,
    userId: 'owner',
    title: id,
    kind: 'TASK',
    startTime: new Date(startTime),
    durationMinutes,
    completedAt: completed ? new Date('2026-09-13T11:00:00.000Z') : null,
    startedAt: null,
    firstStep: null,
    isRecurring: false,
    recurrenceRule: null,
    parentTaskId: null,
    seriesId: null,
  };
}

function setup(existing: ReturnType<typeof task>[]) {
  const prisma = {
    task: {
      findMany: jest.fn().mockResolvedValue(existing),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  } as any;
  const notifications = {
    scheduleTaskReminder: jest.fn(),
    cancelTaskReminder: jest.fn(),
  } as any;
  const plan = { enforceTaskLimit: jest.fn() } as any;
  return { service: new TasksService(prisma, notifications, plan), prisma };
}

describe('TasksService schedule conflicts', () => {
  it('rejects a new interval that overlaps a completed task', async () => {
    const occupied = task('completed', '2026-09-13T16:00:00.000Z', 45, true);
    const { service, prisma } = setup([occupied]);

    await expect(service.create('owner', {
      title: 'Новая',
      startTime: '2026-09-13T16:30:00.000Z',
      durationMinutes: 30,
    })).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'TASK_TIME_SLOT_OCCUPIED',
        message: 'Это время уже занято',
      }),
    });
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('allows a task to start exactly when the previous task ends', async () => {
    const occupied = task('previous', '2026-09-13T16:00:00.000Z', 45);
    const created = task('created', '2026-09-13T16:45:00.000Z', 30);
    const { service, prisma } = setup([occupied]);
    prisma.task.create.mockResolvedValue(created);

    await expect(service.create('owner', {
      title: 'Следующая',
      startTime: '2026-09-13T16:45:00.000Z',
      durationMinutes: 30,
    })).resolves.toEqual(created);
  });

  it('rejects an edit into another task while excluding the edited row itself', async () => {
    const edited = task('edited', '2026-09-13T15:00:00.000Z', 30);
    const occupied = task('other', '2026-09-13T16:00:00.000Z', 60, true);
    const { service, prisma } = setup([occupied]);
    prisma.task.findUnique.mockResolvedValue(edited);

    await expect(service.update('owner', edited.id, {
      startTime: '2026-09-13T16:30:00.000Z',
      durationMinutes: 30,
    })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.task.update).not.toHaveBeenCalled();
    expect(prisma.task.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { notIn: ['edited'] } }),
    }));
  });

  it('rejects two unknown-duration tasks at the same start without inventing an end', async () => {
    const occupied = task('unknown', '2026-09-13T16:00:00.000Z', null);
    const { service, prisma } = setup([occupied]);

    await expect(service.create('owner', {
      title: 'Ещё одна',
      startTime: '2026-09-13T16:00:00.000Z',
      durationMinutes: null,
    })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('moves one recurring occurrence to Thoughts without changing its series', async () => {
    const occurrence = { ...task('occurrence', '2026-09-13T16:00:00.000Z', 30), seriesId: 'series-1', recurrenceDateKey: '2026-09-13' };
    const detached = { ...occurrence, startTime: null, seriesId: null, recurrenceDateKey: null, recurrenceRule: null };
    const { service, prisma } = setup([]);
    prisma.task.findUnique.mockResolvedValue(occurrence);
    prisma.task.update.mockResolvedValue(detached);

    await expect(service.update('owner', occurrence.id, { startTime: null })).resolves.toMatchObject({
      id: occurrence.id,
      startTime: null,
      seriesId: null,
      affectedOccurrenceIds: [occurrence.id],
    });
    expect(prisma.task.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: occurrence.id },
      data: expect.objectContaining({
        startTime: null,
        seriesId: null,
        recurrenceDateKey: null,
      }),
    }));
  });
});
