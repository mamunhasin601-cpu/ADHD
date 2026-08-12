# Task 0004C1: Apply the Conditional Recovery Write

**Status:** execute now  
**Scope:** exactly one source file  
**Allowed file:** `apps/api/src/tasks/task-recovery.service.ts`  
**Next:** `0004c2-test-recovery-transaction.md`

## Command

Make the edit immediately. This is a pre-approved mechanical replacement.

- Do not write a plan or analysis.
- Do not read ADR-008, the spec file, or any unrelated file.
- Do not inspect alternative implementations.
- Do not ask for permission or confirmation.
- Your first repository tool action after reading this task must edit
  `apps/api/src/tasks/task-recovery.service.ts`.

## Exact edit

In `rescheduleTasks`, replace the entire block beginning with:

```ts
// --- Stale state validation (ADR-008 D-6) ---
```

and ending with the closing line of:

```ts
const updatedTasks = await this.prisma.$transaction(async (tx) => {
  // existing implementation
});
```

with this exact code:

```ts
// Enforce recovery eligibility in the write itself so a concurrent completion
// or reschedule cannot be overwritten.
await this.prisma.$transaction(async (tx) => {
  for (const item of items) {
    const newStartTime =
      item.targetStartTime != null ? new Date(item.targetStartTime) : null;

    const result = await tx.task.updateMany({
      where: {
        id: item.taskId,
        userId,
        completedAt: null,
        parentTaskId: null,
        isRecurring: false,
        startTime: { not: null, lt: localDayStart },
      },
      data: { startTime: newStartTime },
    });

    if (result.count !== 1) {
      throw new ConflictException({
        message:
          'Some tasks are no longer overdue or have changed since the recovery list was loaded',
        code: 'STALE_RECOVERY_STATE',
        staleTaskIds: [item.taskId],
      });
    }
  }
});

const updatedTasks = await this.prisma.task.findMany({
  where: {
    id: { in: taskIds },
    userId,
  },
});
```

Do not change any other code. In particular:

- preserve explicit `null` as the Inbox destination;
- keep reminder synchronization after the transaction commits;
- preserve the existing `ok` and `partial` response behavior;
- do not add or claim row locking;
- do not edit tests in this run.

## Verify

Run only:

```powershell
npm run build:api
git diff --check -- apps/api/src/tasks/task-recovery.service.ts
```

If the build fails because of this exact edit, fix the failure only in the allowed service file.
Do not broaden the task.

## Completion contract

This task is incomplete unless the service file is actually modified. In the final response,
report the changed file and the two command results. Stop after verification and do not begin
Task 0004C2.
