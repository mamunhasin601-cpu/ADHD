import { TasksService } from './tasks.service';

const ROOT_ID = '00000000-0000-4000-8000-000000000001';
const KEEP_ID = '00000000-0000-4000-8000-000000000002';
const REMOVE_ID = '00000000-0000-4000-8000-000000000003';
const OTHER_ID = '00000000-0000-4000-8000-000000000004';
const SAME_OWNER_ROOT_ID = '00000000-0000-4000-8000-000000000006';
const SAME_OWNER_PART_ID = '00000000-0000-4000-8000-000000000007';

function setup(initial: any[] = []) {
  let rows = new Map(initial.map((row) => [row.id, { ...row, subTasks: undefined }]));
  let sequence = 10;
  let failPartCreate = false;
  let failPartUpdate = false;
  const events: string[] = [];
  const materialize = (row: any, include?: any) => row && ({
    ...row,
    ...(include?.subTasks && {
      subTasks: [...rows.values()].filter((part) => part.parentTaskId === row.id).map((part) => ({ ...part })),
    }),
  });
  const matches = (row: any, where: any) => {
    if (!where) return true;
    if (where.parentTaskId !== undefined && row.parentTaskId !== where.parentTaskId) return false;
    if (where.id?.notIn?.includes(row.id)) return false;
    if (where.id?.in && !where.id.in.includes(row.id)) return false;
    return true;
  };
  const task: any = {
    create: jest.fn(async ({ data, include }: any) => {
      if (data.parentTaskId && failPartCreate) throw new Error('part insert failed');
      const id = data.id ?? `00000000-0000-4000-8000-${String(sequence++).padStart(12, '0')}`;
      const row = {
        id, userId: data.userId, title: data.title, parentTaskId: data.parentTaskId ?? null,
        startTime: data.startTime ?? null, durationMinutes: data.durationMinutes ?? null,
        color: data.color ?? '#6B5BFC', isRecurring: data.isRecurring ?? false,
        recurrenceRule: data.recurrenceRule ?? null, seriesId: data.seriesId ?? null,
        completedAt: data.completedAt ?? null, startedAt: data.startedAt ?? null,
        firstStep: data.firstStep ?? null, createdAt: new Date(), updatedAt: new Date(),
      };
      rows.set(id, row); events.push(`create:${row.parentTaskId ? 'part' : 'root'}:${id}`);
      return materialize(row, include);
    }),
    findUnique: jest.fn(async ({ where, include }: any) => materialize(rows.get(where.id), include)),
    update: jest.fn(async ({ where, data, include }: any) => {
      const row = rows.get(where.id);
      if (!row) throw new Error('missing row');
      if (row.parentTaskId && failPartUpdate) throw new Error('part reconcile failed');
      const updated = { ...row, ...data, updatedAt: new Date() };
      rows.set(where.id, updated); events.push(`update:${row.parentTaskId ? 'part' : 'root'}:${where.id}`);
      return materialize(updated, include);
    }),
    deleteMany: jest.fn(async ({ where }: any) => {
      const ids = [...rows.values()].filter((row) => matches(row, where)).map((row) => row.id);
      ids.forEach((id) => rows.delete(id));
      events.push(`deleteMany:${ids.join(',')}`);
      return { count: ids.length };
    }),
    delete: jest.fn(async ({ where }: any) => {
      const row = rows.get(where.id); rows.delete(where.id);
      for (const part of [...rows.values()]) if (part.parentTaskId === where.id) rows.delete(part.id);
      events.push(`delete:${where.id}`); return row;
    }),
    findMany: jest.fn(async ({ where, select }: any) => [...rows.values()]
      .filter((row) => matches(row, where))
      .map((row) => select?.id ? { id: row.id } : materialize(row))),
    count: jest.fn(async ({ where }: any) => [...rows.values()].filter((row) => matches(row, where)).length),
  };
  const prisma: any = { task, user: { findUnique: jest.fn() } };
  prisma.$transaction = jest.fn(async (callback: any) => {
    const snapshot = structuredClone(rows); events.push('transaction:start');
    try {
      const value = await callback(prisma); events.push('transaction:commit'); return value;
    } catch (error) {
      rows = snapshot; events.push('transaction:rollback'); throw error;
    }
  });
  const notifications = {
    scheduleTaskReminder: jest.fn(async (row: any) => { events.push(`reminder:schedule:${row.id}`); }),
    cancelTaskReminder: jest.fn(async (id: string) => { events.push(`reminder:cancel:${id}`); }),
  };
  const plan = { enforceTaskLimit: jest.fn() };
  return {
    service: new TasksService(prisma, notifications as any, plan as any), prisma, notifications, plan, events,
    rows: () => [...rows.values()],
    failPartCreate: () => { failPartCreate = true; },
    failPartUpdate: () => { failPartUpdate = true; },
  };
}

const root = (overrides: any = {}) => ({
  id: ROOT_ID, userId: 'owner', title: 'Parent', parentTaskId: null, startTime: null,
  durationMinutes: null, color: '#6B5BFC', isRecurring: false, recurrenceRule: null,
  seriesId: null, completedAt: null, startedAt: null, firstStep: null,
  createdAt: new Date(), updatedAt: new Date(), ...overrides,
});
const part = (id: string, overrides: any = {}) => ({
  ...root({ id, title: id, parentTaskId: ROOT_ID }), ...overrides,
});

describe('TasksService authoritative manual parts', () => {
  it('atomically creates a parent and canonical server-id parts, then syncs only the root reminder', async () => {
    const h = setup();
    const result: any = await h.service.create('owner', {
      title: 'Parent', startTime: '2026-08-18T10:00:00Z',
      subTasks: [{ title: ' One ' }, { title: 'Two', completed: true }],
    });
    expect(result.subTasks).toHaveLength(2);
    expect(result.subTasks.map(({ id }: any) => id)).toEqual(h.rows().filter((row) => row.parentTaskId === result.id).map(({ id }) => id));
    expect(result.subTasks![0]).toMatchObject({ title: 'One', completedAt: null, parentTaskId: result.id, userId: 'owner' });
    expect(result.subTasks![1].completedAt).toBeInstanceOf(Date);
    expect(h.events.indexOf('transaction:commit')).toBeLessThan(h.events.findIndex((event) => event.startsWith('reminder:')));
    expect(h.notifications.scheduleTaskReminder).toHaveBeenCalledTimes(1);
    expect(h.notifications.scheduleTaskReminder).toHaveBeenCalledWith(expect.objectContaining({ id: result.id }));
    expect(h.plan.enforceTaskLimit).toHaveBeenCalledTimes(1);
  });

  it('rolls back every row and emits no reminder effect when a part insert fails', async () => {
    const h = setup(); h.failPartCreate();
    await expect(h.service.create('owner', { title: 'Parent', subTasks: [{ title: 'Part' }] }))
      .rejects.toThrow('part insert failed');
    expect(h.rows()).toEqual([]);
    expect(h.events).toContain('transaction:rollback');
    expect(h.notifications.scheduleTaskReminder).not.toHaveBeenCalled();
    expect(h.notifications.cancelTaskReminder).not.toHaveBeenCalled();
  });

  it('retains stable ids and completion state while creating and removing parts atomically', async () => {
    const completedAt = new Date('2026-08-16T12:00:00Z');
    const h = setup([root(), part(KEEP_ID, { title: 'Keep', completedAt }), part(REMOVE_ID)]);
    const result: any = await h.service.update('owner', ROOT_ID, {
      title: 'Edited', subTasks: [{ id: KEEP_ID, title: 'Kept', completed: true }, { title: 'New' }],
    });
    expect(result).toMatchObject({ id: ROOT_ID, title: 'Edited' });
    expect(result.subTasks).toHaveLength(2);
    expect(result.subTasks.find((row: any) => row.id === KEEP_ID)).toMatchObject({ title: 'Kept', completedAt });
    expect(h.rows().some((row) => row.id === REMOVE_ID)).toBe(false);
    expect(result.subTasks.find((row: any) => row.id !== KEEP_ID)?.id).toMatch(/^00000000-0000-4000-8000-/);
  });

  it('rolls back the parent update and deletions when reconciliation fails, with no reminder effect', async () => {
    const h = setup([root(), part(KEEP_ID), part(REMOVE_ID)]); h.failPartUpdate();
    await expect(h.service.update('owner', ROOT_ID, {
      title: 'Must roll back', subTasks: [{ id: KEEP_ID, title: 'Failure' }],
    })).rejects.toThrow('part reconcile failed');
    expect(h.rows().find((row) => row.id === ROOT_ID)?.title).toBe('Parent');
    expect(h.rows().some((row) => row.id === REMOVE_ID)).toBe(true);
    expect(h.notifications.scheduleTaskReminder).not.toHaveBeenCalled();
    expect(h.notifications.cancelTaskReminder).not.toHaveBeenCalled();
  });

  it('rejects duplicate, foreign, wrong-parent, nested, and recurring drafts before committing changes', async () => {
    const otherRoot = root({ id: OTHER_ID, userId: 'other' });
    const foreignPart = part('00000000-0000-4000-8000-000000000005', { userId: 'other', parentTaskId: OTHER_ID });
    const h = setup([root(), part(KEEP_ID), otherRoot, foreignPart]);
    await expect(h.service.update('owner', ROOT_ID, { subTasks: [
      { id: KEEP_ID, title: 'A' }, { id: KEEP_ID, title: 'B' },
    ] })).rejects.toMatchObject({ status: 400 });
    await expect(h.service.update('owner', ROOT_ID, { subTasks: [{ id: foreignPart.id, title: 'Foreign' }] }))
      .rejects.toMatchObject({ status: 403 });
    await expect(h.service.update('owner', ROOT_ID, { subTasks: [{ id: OTHER_ID, title: 'Wrong' }] }))
      .rejects.toMatchObject({ status: 403 });
    await expect(h.service.update('owner', ROOT_ID, { subTasks: [{ title: 'Nested', subTasks: [] } as any] }))
      .rejects.toMatchObject({ status: 400 });
    const recurring = setup([root({ isRecurring: true, recurrenceRule: 'FREQ=DAILY' })]);
    await expect(recurring.service.update('owner', ROOT_ID, { subTasks: [] })).rejects.toMatchObject({ status: 400 });
  });

  it('rejects a same-owner part id belonging to another parent', async () => {
    const h = setup([
      root(),
      root({ id: SAME_OWNER_ROOT_ID }),
      part(SAME_OWNER_PART_ID, { parentTaskId: SAME_OWNER_ROOT_ID }),
    ]);
    await expect(h.service.update('owner', ROOT_ID, {
      subTasks: [{ id: SAME_OWNER_PART_ID, title: 'Wrong parent' }],
    })).rejects.toMatchObject({ status: 400 });
  });

  it('keeps legacy direct part writes root-only and free of scheduling and reminder side effects', async () => {
    const h = setup([root()]);
    const created = await h.service.create('owner', { title: 'Legacy part', parentTaskId: ROOT_ID });
    expect(created).toMatchObject({ parentTaskId: ROOT_ID, startTime: null, durationMinutes: null });
    expect(h.plan.enforceTaskLimit).not.toHaveBeenCalled();
    expect(h.notifications.scheduleTaskReminder).not.toHaveBeenCalled();
    expect(h.notifications.cancelTaskReminder).not.toHaveBeenCalled();

    await expect(h.service.create('owner', {
      title: 'Scheduled part', parentTaskId: ROOT_ID, startTime: '2026-08-18T10:00:00Z',
    })).rejects.toMatchObject({ status: 400 });
    await expect(h.service.update('owner', created.id, { firstStep: 'Not allowed' }))
      .rejects.toMatchObject({ status: 400 });
    await expect(h.service.start('owner', created.id)).rejects.toMatchObject({ status: 400 });

    await h.service.toggleComplete('owner', created.id);
    expect(h.notifications.scheduleTaskReminder).not.toHaveBeenCalled();
    expect(h.notifications.cancelTaskReminder).not.toHaveBeenCalled();
  });

  it('deletes a non-recurring parent and all parts in one transaction without promoting hidden rows', async () => {
    const h = setup([root(), part(KEEP_ID), part(REMOVE_ID)]);
    const result = await h.service.remove('owner', ROOT_ID);
    expect(h.rows()).toEqual([]);
    expect(result.affectedOccurrenceIds).toEqual([ROOT_ID, KEEP_ID, REMOVE_ID]);
    expect(h.events).toContain('transaction:commit');
    expect(h.notifications.cancelTaskReminder).toHaveBeenCalledTimes(1);
    expect(h.notifications.cancelTaskReminder).toHaveBeenCalledWith(ROOT_ID);
  });

  it('keeps omitted create and update on the direct legacy path', async () => {
    const create = setup();
    const created = await create.service.create('owner', { title: 'Legacy' });
    expect(created.title).toBe('Legacy');
    expect(create.prisma.$transaction).not.toHaveBeenCalled();

    const update = setup([root()]);
    await update.service.update('owner', ROOT_ID, { title: 'Legacy edit' });
    expect(update.prisma.$transaction).not.toHaveBeenCalled();
    expect(update.rows().find((row) => row.id === ROOT_ID)?.title).toBe('Legacy edit');
  });
});
