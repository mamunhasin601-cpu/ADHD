# Task 0004C: Make Recovery Writes Concurrency-Safe

**Status:** superseded; do not execute  
**Replaced by:** `0004c1-fix-recovery-transaction-write.md` and
`0004c2-test-recovery-transaction.md`  
**Reason:** this package combined source changes, test redesign, ADR review, and broad verification
in one run. The execution repeatedly stopped during analysis without modifying a file.

Use the two replacement packages in order. Do not execute the instructions below.

## Command

Implement the transaction correction now. Do not produce a plan-only response or ask for
permission. Read only the current recovery service/spec and ADR-008 D-4/D-6.

## Required behavior

The current authoritative stale check occurs before `$transaction`, creating a race. Replace it
with write-time conditional enforcement:

- keep cheap input and ownership checks before the transaction when useful;
- inside one Prisma transaction, update each item with `updateMany` whose `where` includes:
  `id`, `userId`, `completedAt: null`, `parentTaskId: null`, `isRecurring: false`, and overdue
  `startTime` (`not: null`, `lt: localDayStart`);
- require `result.count === 1` for every item;
- if any count is not one, throw the existing stale-state `ConflictException` inside the
  transaction so all earlier item updates roll back;
- fetch/return the updated tasks consistently for post-commit reminder synchronization;
- keep reminder synchronization after commit and preserve `ok`/`partial` response behavior;
- do not claim or emulate row locking that Prisma did not actually perform.

Do not overwrite a concurrent completion or reschedule. Preserve explicit `null` Inbox writes
and all non-scheduling fields.

## Tests

Update the recovery service mocks from `update` to `updateMany` where necessary. Add tests proving:

- a concurrent stale change makes `updateMany` return count zero and produces Conflict without
  reminder sync;
- a failure on a later item rolls back the batch transaction;
- successful date and explicit-null updates return the expected result;
- reminder `ok` and `partial` behavior remains unchanged.

Run focused recovery tests, all API unit tests, API build, API e2e, and `git diff --check`. Fix
in-scope failures before finishing.

This task is incomplete unless service and test files are actually modified. Stop after
verification; Task 0005 is a separate run.
