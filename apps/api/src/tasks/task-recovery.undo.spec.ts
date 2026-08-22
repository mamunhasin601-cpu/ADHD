import { ConflictException, ForbiddenException } from '@nestjs/common';
import { TaskRecoveryService } from './task-recovery.service';

describe('TaskRecoveryService authoritative undo', () => {
  const now = new Date('2026-08-22T12:00:00.000Z');
  const expiresAt = new Date('2026-08-22T12:15:00.000Z');
  const appliedAt = new Date('2026-08-22T11:59:00.123Z');
  const previous = new Date('2026-08-21T18:35:12.345Z');
  const task = { id: 'task-1', userId: 'owner', kind: 'TASK', title: 'x', startTime: previous, completedAt: null, startedAt: null, durationMinutes: 5, color: '#fff', isRecurring: false, recurrenceRule: null, recurrenceTimezone: null, recurrenceDateKey: null, recurrenceGeneratedThrough: null, recurrenceEndedAt: null, seriesId: null, parentTaskId: null, firstStep: null, createdAt: now, updatedAt: now };

  function harness(options: { owner?: string; expired?: boolean; replay?: boolean; stale?: boolean; reminderFails?: boolean; previousStart?: Date | null } = {}) {
    const record = { id: 'undo-1', userId: options.owner ?? 'owner', expiresAt: options.expired ? now : expiresAt, consumedAt: options.replay ? now : null };
    const item = { undoId: 'undo-1', taskId: task.id, previousStartTime: options.previousStart === undefined ? previous : options.previousStart, appliedStartTime: null, appliedUpdatedAt: appliedAt };
    const tx: any = {
      recoveryUndo: { updateMany: jest.fn().mockResolvedValue({ count: options.replay ? 0 : 1 }), findUnique: jest.fn().mockResolvedValue(record) },
      recoveryUndoItem: { findMany: jest.fn().mockResolvedValue([item]) },
      task: { updateMany: jest.fn().mockResolvedValue({ count: options.stale ? 0 : 1 }), findMany: jest.fn().mockResolvedValue([{ ...task, startTime: item.previousStartTime }]) },
    };
    const prisma: any = {
      recoveryUndo: { findUnique: jest.fn().mockResolvedValue(record), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      task: { findMany: jest.fn().mockResolvedValue([{ ...task, startTime: item.previousStartTime }]) },
      $transaction: jest.fn((fn) => fn(tx)),
    };
    const scheduleTaskReminder = jest.fn();
    if (options.reminderFails) scheduleTaskReminder.mockRejectedValue(new Error('queue'));
    else scheduleTaskReminder.mockResolvedValue(undefined);
    const notifications: any = { scheduleTaskReminder, cancelTaskReminder: jest.fn().mockResolvedValue(undefined) };
    return { service: new TaskRecoveryService(prisma, notifications), prisma, tx, notifications };
  }

  it.each([[previous], [null]])('restores the exact authoritative previous instant, including null', async (previousStart) => {
    const { service, tx } = harness({ previousStart });
    const result = await service.undoRecovery('owner', 'undo-1', now);
    expect(tx.task.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { startTime: previousStart } }));
    expect(result.taskRestoreStatus).toBe('ok');
  });

  it('rejects another owner and an expired identity deterministically', async () => {
    await expect(harness({ owner: 'other' }).service.undoRecovery('owner', 'undo-1', now)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(harness({ expired: true }).service.undoRecovery('owner', 'undo-1', now)).rejects.toMatchObject({ response: expect.objectContaining({ code: 'RECOVERY_UNDO_EXPIRED' }) });
  });

  it('makes replay idempotent without rewriting tasks', async () => {
    const { service, prisma, tx } = harness({ replay: true });
    await expect(service.undoRecovery('owner', 'undo-1', now)).resolves.toMatchObject({
      taskRestoreStatus: 'already-undone', restoredCount: 0,
      tasks: [{ id: 'task-1', startTime: previous }],
    });
    expect(tx.task.updateMany).not.toHaveBeenCalled();
    expect(prisma.task.findMany).toHaveBeenCalled();
  });

  it('a retry after a lost response reconciles reminders and reports repeated failure honestly', async () => {
    const { service, prisma, tx } = harness({ replay: true, reminderFails: true });
    const result = await service.undoRecovery('owner', 'undo-1', now);
    expect(result).toMatchObject({ taskRestoreStatus: 'already-undone', reminderSyncStatus: 'partial', failedReminderSyncs: ['task-1'] });
    expect(tx.task.updateMany).not.toHaveBeenCalled();
    expect(prisma.recoveryUndo.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ reminderSyncStatus: 'partial' }) }));
  });

  it('replay reads a later authoritative edit without overwriting it', async () => {
    const { service, prisma, tx } = harness({ replay: true });
    const later = new Date('2026-08-24T09:00:00.999Z');
    prisma.task.findMany.mockResolvedValue([{ ...task, startTime: later }]);
    const result = await service.undoRecovery('owner', 'undo-1', now);
    expect(result.tasks).toEqual([{ id: 'task-1', startTime: later }]);
    expect(tx.task.updateMany).not.toHaveBeenCalled();
  });

  it('rolls back the claim and all restores when any task is stale', async () => {
    const { service, notifications } = harness({ stale: true });
    await expect(service.undoRecovery('owner', 'undo-1', now)).rejects.toBeInstanceOf(ConflictException);
    expect(notifications.scheduleTaskReminder).not.toHaveBeenCalled();
  });

  it('reports reminder failure after the committed restore', async () => {
    const { service, tx } = harness({ reminderFails: true });
    const result = await service.undoRecovery('owner', 'undo-1', now);
    expect(tx.task.updateMany).toHaveBeenCalled();
    expect(result).toMatchObject({ taskRestoreStatus: 'ok', reminderSyncStatus: 'partial', failedReminderSyncs: ['task-1'] });
  });
});
