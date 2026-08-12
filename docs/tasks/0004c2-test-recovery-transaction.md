# Task 0004C2: Test the Conditional Recovery Transaction

**Status:** execute only after Task 0004C1 is accepted  
**Scope:** focused recovery service tests  
**Allowed file:** `apps/api/src/tasks/task-recovery.service.spec.ts`  
**Next:** `0005-add-recovery-inbox-path.md`

## Command

Update the existing focused tests to match the already-implemented `updateMany` transaction.
Make the test edits now. Do not write a plan, read ADRs, change production code, or ask for
permission. Preserve unrelated tests and user changes.

## Required test changes

- Replace transaction mocks and expectations based on `task.update` with `task.updateMany`.
- Mock the post-commit `prisma.task.findMany` call that reloads updated tasks for reminder sync.
- Prove a successful dated destination writes the requested `Date` and returns success.
- Prove an explicit `null` destination writes `startTime: null` and cancels its reminder.
- Prove `updateMany` returning `{ count: 0 }` throws `ConflictException` with code
  `STALE_RECOVERY_STATE` and does not call reminder synchronization.
- Prove a zero count on a later item rejects the transaction and does not call reminder
  synchronization. Model transaction rollback through the existing transaction mock; do not
  claim that a unit mock proves database rollback semantics.
- Preserve coverage for reminder status `ok` and `partial` after a successful commit.

Tests must assert that every conditional write includes:

```ts
{
  id: item.taskId,
  userId,
  completedAt: null,
  parentTaskId: null,
  isRecurring: false,
  startTime: { not: null, lt: expect.any(Date) },
}
```

## Verify

Run:

```powershell
npm run test --workspace=apps/api -- task-recovery.service.spec.ts --runInBand
npm run test:api -- --runInBand
npm run build:api
git diff --check -- apps/api/src/tasks/task-recovery.service.spec.ts
```

Fix in-scope test failures in the allowed spec file. If production code fails these expectations,
stop and report the exact mismatch instead of editing production code.

## Completion contract

This task is incomplete unless the spec file is actually modified and the focused tests run.
Report the changed file, test counts, and every command result. Stop after verification; do not
begin Task 0005.
