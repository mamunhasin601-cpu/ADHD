# Task 0017 — explicit task start state

**Status:** Completed

## User problem and product basis

The scheduled instant only says where a task belongs in the day. It does not
prove action. In accordance with Constitution Articles 4, 6, 14, and 15 and the
accepted PDR-001 timeline-centered experience, Focus now requires a deliberate
user command before presenting a task as started.

## Persisted meaning and transitions

`Task.startedAt: DateTime?` is the server-recorded time of the current explicit
start. Its default is `null`, the nullable forward migration leaves every
existing row `null`, and the field is not exposed in create/update DTOs or the
Task Form. It is not a timer, continuous-attention claim, or focus session.
Since the Task 0039 Realme corrective package, it is also the canonical active
lease: at most one incomplete task per user may retain it. A confirmed switch
clears it from the previous task without completing, deleting, rescheduling, or
changing recurrence identity.

Transitions are `unstarted + incomplete -> started + incomplete` through the
start command; a retry stays at the original timestamp; completion remains
valid with or without a prior start; and a completed unstarted task rejects
start with HTTP 409. Starting another task first returns a typed conflict; only
an explicit confirmed switch atomically clears every other legacy active start
and records the target's actual server start instant.

## API and reminders

Authenticated `PATCH /tasks/:id/start` uses the standard UUID pipe and ownership
check and returns the normal Task response. With another active task, the
ordinary request returns `ACTIVE_TASK_CONFLICT` plus the minimal active-task
identity. Retrying with `{ "confirmSwitch": true }` runs the lost-focus writes
and target start in one serializable transaction with retry on serialization
conflict. Thus simultaneous requests cannot commit two active tasks. Missing
and inaccessible tasks retain the existing 404/403 behavior and completed tasks
receive a calm conflict.

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

Residual limitations are intentional: there is no pause/resume, timer, focus
session, assistant, or decomposition. Single-active exclusivity is scoped per
user, not globally across users. Migration application awaits an explicitly
disposable database.

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

## Future-action confirmation corrective package — 2026-09-28

Source diagnosis separates Start/Switch from completion. The transactional
switch path writes only `startedAt = null` to prior incomplete active tasks and
never writes `completedAt`; its service regression proves the previous row
remains incomplete. The only completion writer is the explicit toggle command.
Before this correction, the completion circle called that command directly and
the dated mobile cache optimistically synthesized `completedAt`, immediately
painting a check, strike-through, and incremented daily progress before the
server response. A confirmed switch now also reconciles the exact active-task
id named by the conflict, clearing a stale optimistic completion without
reopening unrelated legitimately completed history.

An unstarted future occurrence now requires a calm confirmation before either
completion or Start. Future completion uses `Задача запланирована на
<дата/время>. Отметить выполненной сейчас?`; Cancel, Android Back, and backdrop
dismissal do not mutate, and the completion cache remains unchanged until the
canonical response. A failed response leaves the source task open and the
dialog retryable. Same-day copy uses time only; another profile-local day uses
localized date and time, honoring H12/H24.

Future Start uses `Задача запланирована на <дата/время>. Начать сейчас?`. The
server independently enforces this boundary with typed
`EARLY_START_CONFIRMATION_REQUIRED` and accepts optional
`confirmEarlyStart`. Confirmation preserves scheduled `startTime` and records
actual server `startedAt`. If another task is active, the protocol is ordered:
early confirmation, then `ACTIVE_TASK_CONFLICT`, then a retry carrying both
`confirmEarlyStart` and `confirmSwitch`; no mutation occurs before both are
confirmed. Recurring templates and task parts remain invalid Start targets;
only concrete occurrences participate.

The package adds no timer, session, parallel competitive model, schema, or
migration. Task 0039 remains **physical smoke pending**.

## Task 0039 physical close-out — 2026-09-28

The dated corrective-package note above records the gate before the final
device retest. The required Realme smoke now passes: one active started task,
Stay/Switch behavior, no implicit completion or counter change, next-profile-day
Recovery eligibility, early-Start confirmation, and future-completion
confirmation were physically verified. Task 0039 is accepted within its Phase B
and Timeline corrective scope. Push delivery remains a separate external blocker
because a working EAS `projectId`, credentials, and device push token are not
available. `Сейчас по плану / конкурентная модель` is a later product iteration,
not part of Task 0017 or Task 0039.
