# Task 0004: Fix Recovery Backend Safety

**Status:** superseded as a single execution unit; run Tasks 0004A, 0004B, and 0004C separately  
**Depends on:** existing recovery implementation  
**Next task:** `0005-add-recovery-inbox-path.md`

> Do not execute this file as one Claude Code run. The previous run repeated analysis and ended
> before its first edit. Execute `0004a-fix-oauth-build.md`, then `0004b-fix-recovery-dto.md`,
> then `0004c-fix-recovery-transaction.md`, each in a separate run.

## Execution directive

Implement this task now. This is not a review or plan-only request.

Write one short plan, then edit files immediately in the same run. Do not ask for permission.
The Product Owner and Product Architect pre-approve every source, test, API, auth, and
documentation change explicitly required below. This is the approval required by STEP 6 of
`Product-Bible/AI/Claude-Code.md`; the listed changes do not trigger its Stop Conditions.

You may create, modify, move, or remove in-scope repository files. Preserve unrelated work. Do
not modify Product Bible policy, publish, deploy, push, or change external systems.

Keep the run bounded. Read only the relevant backend files, ADR-008 decisions D-3/D-4/D-6/D-8,
and the applicable Handbook sections. Within the first five tool calls after reading this task,
make the first source edit.

## Goal

Fix the backend blockers identified by Product Review:

1. missing `targetStartTime` silently becomes Inbox;
2. stale validation occurs outside the write transaction;
3. OAuth TypeScript errors prevent API build and e2e execution.

Do not implement Inbox UI or redesign the mobile recovery flow in this task.

## Required changes

### Explicit destination contract

In `apps/api/src/tasks/dto/reschedule-recovery.dto.ts` and the recovery service:

- Require `targetStartTime` to be present on every item.
- Accept only a valid ISO-8601 instant or explicit JSON `null`.
- Reject missing/undefined, malformed, empty, duplicate, and oversized input before writes.
- Never interpret a missing property as Inbox.
- Keep explicit `null` as the only Inbox command.
- Add DTO/controller-boundary tests proving missing and malformed values return validation
  errors and produce no writes.

Use class-validator semantics that distinguish `undefined` from `null`. Do not rely only on
direct service tests, because they bypass the global ValidationPipe.

### Concurrency-safe stale validation

In `apps/api/src/tasks/task-recovery.service.ts`:

- Make ownership, overdue state, recurrence/root state, and destination validation safe against
  concurrent completion or rescheduling.
- Perform the authoritative read and write inside one transaction, or use conditional updates
  whose affected-row count proves every invariant still holds.
- Preserve all-or-nothing batch behavior.
- Do not overwrite a concurrent completion or reschedule.
- Keep reminder synchronization outside the transaction after commit.
- Preserve the `ok` versus `partial` reminder response.
- Add a focused integration/service test that fails under the old read-before-transaction race.

Do not claim row locking if Prisma code does not actually acquire a lock. Use a solution whose
concurrency guarantee is real for PostgreSQL.

### Restore API compilation

Fix only the current OAuth TypeScript blockers:

- `AuthService.generateTokens` visibility used by `OAuthService`;
- the Prisma `OR` array that currently includes `undefined`.

Preserve OAuth behavior. Prefer the smallest typed change and add/update focused tests if the
public method boundary or query construction changes.

## Required verification

Run:

1. API TypeScript/build;
2. API unit tests;
3. API e2e tests;
4. focused recovery DTO/service tests;
5. `git diff --check` for files changed in this task.

If a command fails, diagnose and fix the in-scope cause instead of stopping after reporting it.

## Definition of done

- Omitted `targetStartTime` is rejected and cannot move a task.
- Explicit `null` still moves a task to Inbox.
- Concurrent stale changes cannot be overwritten.
- Batch behavior remains atomic.
- OAuth TypeScript errors are resolved without behavior changes.
- API build, unit tests, and e2e tests execute successfully.
- At least one source file and the required tests are changed in this run.

Report changed files, commands, results, and remaining risks. Then stop; Task 0005 handles Inbox.
