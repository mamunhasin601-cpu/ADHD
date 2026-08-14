# Task 0017 — explicit task start state

**Status:** Completed

## User problem and product basis

The scheduled instant only says where a task belongs in the day. It does not
prove action. In accordance with Constitution Articles 4, 6, 14, and 15 and the
accepted PDR-001 timeline-centered experience, Focus now requires a deliberate
user command before presenting a task as started.

## Persisted meaning and transitions

`Task.startedAt: DateTime?` is the server-recorded time of the first explicit
start. Its default is `null`, the nullable forward migration leaves every
existing row `null`, and the field is not exposed in create/update DTOs or the
Task Form. It is historical evidence of one choice—not a timer, continuous
attention claim, focus session, or exclusive active-task lease. Several tasks
may retain it. Scheduling, editing, recovery, completion, and reopening neither
populate nor erase it.

Transitions are `unstarted + incomplete -> started + incomplete` through the
start command; a retry stays at the original timestamp; completion remains
valid with or without a prior start; reopening preserves `startedAt`; a
completed unstarted task rejects start with HTTP 409.

## API and reminders

Authenticated `PATCH /tasks/:id/start` uses the standard UUID pipe and ownership
check and returns the normal Task response. The server performs an atomic
conditional `updateMany` constrained by `id`, `userId`, `startedAt: null`, and
`completedAt: null`, then reads the canonical row. Thus simultaneous retries
cannot replace the first timestamp. Missing and inaccessible tasks retain the
existing 404/403 behavior and completed tasks receive a calm conflict.

After persistence the backend safely cancels the task reminder. Cancellation
failure is logged but cannot roll back or falsely fail the command. Generic
updates and reopening also refuse to schedule reminders for tasks whose
`startedAt` exists. Mobile caches the exact returned task and safely cancels the
local reminder; a local cancellation failure does not revert UI state. HTTP 409
invalidates the dated cache for reconciliation.

## Now Card and Today

An unstarted current or upcoming task shows `Начать`; pending submission shows
`Начинаю…` with disabled/busy accessibility state. Only the server-confirmed
state shows `Начато` and enables `Завершить`, while `Изменить план` remains the
secondary action. Today uses a synchronous submission guard, preserves the
unstarted card on failure, shows a retryable Russian error, and renders no live
Now Card on another selected date. Clock text continues through the existing
SYSTEM/H24/H12 formatter. Merely reaching `startTime` never creates `startedAt`.

## Changed files and migration evidence

The implementation changes the Prisma schema/service/controller/tests, adds
`20260814000000_add_task_started_at`, extends shared types, adds the mobile
mutation, updates Today/NowCard and focused tests, updates fixture contracts,
this document, and the roadmap. The migration SQL is a single nullable
`ALTER TABLE "tasks" ADD COLUMN "startedAt" TIMESTAMP(3)` statement, statically
validated with Prisma. No disposable database was available, so application of
the migration remains unverified rather than being attempted against an unknown
database.

## Verification and residual limitations

Focused commands: `npm test --workspace=apps/api -- --runInBand
tasks/tasks.service.spec.ts`, `npm test --workspace=apps/api -- --runInBand
tasks/tasks.controller.start.spec.ts`, `npm test --workspace=apps/mobile --
--runInBand components/NowCard.spec.tsx`, and `npm test --workspace=apps/mobile
-- --runInBand lib/api/tasks.start.spec.tsx`. Complete commands are `npm test
--workspace=apps/api -- --runInBand`, `npm test --workspace=apps/mobile --
--runInBand`, both application `tsc --noEmit` commands, Prisma validate/generate,
and both diff checks. Complete results: API 15 suites / 238 tests and mobile 26 suites / 335 tests,
all passing. Focused results: service 1/26, controller 1/1, Now Card 1/5,
and mobile mutation 1/2, all passing.

Residual limitations are intentional: no pause/resume, timer, focus session,
assistant, decomposition, or global active-task exclusivity exists. Migration
application awaits an explicitly disposable database.

## Review follow-up verification

The coverage follow-up restores the complete Now Card regression suite, adds
deterministic concurrent-start and completion-race service tests, expands route
metadata and production ValidationPipe boundaries, makes `onStart` mandatory,
scopes Today errors by task and canonical date, and adds focused Today and
React Query mutation integration suites. Follow-up files are:

- `apps/api/src/tasks/tasks.controller.start.spec.ts`
- `apps/api/src/tasks/tasks.service.start.spec.ts`
- `apps/api/src/tasks/dto/task-start-boundary.dto.spec.ts`
- `apps/mobile/app/(tabs)/today.tsx`
- `apps/mobile/components/NowCard.tsx`
- `apps/mobile/components/NowCard.spec.tsx`
- `apps/mobile/lib/api/tasks.start.spec.tsx`
- `apps/mobile/tests/today-start-task.spec.tsx`
- `docs/tasks/0017-explicit-task-start-state.md`

Focused results are API 4 suites / 38 tests and mobile 5 suites / 40 tests.
The required mutation `--detectOpenHandles` run is 1 suite / 5 tests and exits
without warnings. Complete results are API 17 suites / 249 tests and mobile 27
suites / 347 tests. All pass. The complete mobile run still prints established
React Native `Modal` act warnings from `today-create-task.spec.tsx`; the new
start mutation and Today start suites produce no warning or open-handle output.
Both TypeScript checks and Prisma validate/generate pass. The non-connected
placeholder database URL was used only for static Prisma tooling; migration
application remains unverified because no disposable running database exists.
