# Task 0002: Implement Guilt-Free Recovery

**Status:** ready for implementation  
**Owner:** Claude Code, Lead Software Engineer  
**Input package:** `docs/tasks/0001-guilt-free-recovery.md`  
**Architecture decision:** `docs/ADR/ADR-008-overdue-task-recovery.md`

## Permissions and boundaries

For this task, **you are explicitly allowed to modify project files**, including production
source code, tests, API contracts, mobile UI, and engineering documentation. Do not limit the
work to documentation changes.

Changes are allowed in:

- `apps/api/**` and `packages/**` for backend and shared contracts;
- `apps/mobile/**` for API hooks, components, and the Today screen;
- tests and test fixtures;
- `docs/API.md`, `docs/Backend.md`, `docs/Architecture.md`,
  `docs/Engineering-Handbook-v5.md`, `docs/ai/IMPLEMENTATION_STATE_v2.md`,
  `docs/ai/NEXT_STEPS_v2.md`, and related engineering documentation;
- `docs/ADR/ADR-008-overdue-task-recovery.md` when correcting factual details.

Do not change `Product-Bible/**` without a separate Product Owner decision. Do not add new
product capabilities or perform unrelated refactoring.

## Goal

Implement one vertical slice of **Come Back Without Guilt**: a user can see unfinished tasks
from previous days on Today, choose what to do with them, review an explicit destination, and
confirm moving each selected task to Today/a future time or to Inbox.

## User problem

`TasksService.findAll` currently returns only tasks for the selected day. After a missed day,
unfinished work disappears from Today and the user has no calm, controlled way to continue.

## Required context

Before implementation, read:

1. `Product-Bible/AI/Claude-Code.md`;
2. `docs/tasks/0001-guilt-free-recovery.md`;
3. `docs/ADR/ADR-008-overdue-task-recovery.md`;
4. Relevant sections of `docs/Engineering-Handbook-v5.md` (2, 6, 7, 8, 9, 10, 11, 14, 15,
   16, 17, and 22.2-22.7);
5. The current tasks, notifications, plan, and Today-screen implementation.

If code and documentation disagree, record the fact, choose the smallest compatible solution,
and update engineering documentation. Do not change product policy yourself.

## Functional requirements

### Backend

- Add an authenticated `GET /tasks/recovery?date=YYYY-MM-DD` endpoint.
- Return only root tasks owned by the current user where `startTime` is strictly before the
  start of the current local day, `completedAt IS NULL`, `parentTaskId IS NULL`, and
  `isRecurring = false`.
- Compute the local-day start on the server using the user's stored IANA timezone. A client
  date must not silently change the overdue boundary.
- Add an authenticated `POST /tasks/recovery/reschedule` endpoint with:
  `{ items: [{ taskId: UUID, targetStartTime: ISO-8601 | null }] }`.
- `null` means an explicitly selected move to Inbox. Reject an empty list, invalid UUIDs or
  dates, past destinations, the current Free-tier limit, and duplicate items.
- Validate ownership and stale state for every item before writing. Any failure rejects the
  entire operation without partial writes.
- Update only scheduling fields for selected tasks in one Prisma transaction. Preserve title,
  duration, color, recurrence metadata, parent relation, and completion state.
- After commit, synchronize reminders through the existing notification boundary. A queue
  failure must not roll back the task update; the result must distinguish task-write status
  from reminder-sync status.
- Repeating the same confirmed mapping must not create additional task changes or duplicate
  reminder jobs.
- Register recovery routes before the parameterized `GET /tasks/:id` route.

### Mobile

- Add typed API client/hooks `useOverdueTasks` and a reschedule mutation in
  `apps/mobile/lib/api/tasks.ts` or the existing equivalent module.
- On Today, show one neutral recovery entry only for the current local date and only when
  overdue tasks exist.
- Implement subset selection, an explicit destination preview for every selected task,
  cancel, and confirm. Opening the entry must not mutate data.
- Support an explicit Today/future time destination or `Move to Inbox`; never assign a
  destination silently or create an automatic make-up plan.
- On success, invalidate Today, Inbox, and recovery React Query keys. On failure, preserve the
  previous screen state and show a retryable state. Do not put recovery data in the auth/UI
  store.
- Follow existing accessibility, touch-target, and neutral-copy conventions.

## Mandatory acceptance criteria

- An overdue task appears on Today; with no overdue tasks, the recovery entry is absent.
- Opening Today or the recovery entry does not change data.
- One or multiple tasks can be selected, the mapping is visible before confirmation, and
  cancel performs no write.
- A mixed mapping (date/time and `null`) applies only to selected tasks.
- A foreign, completed, future, recurring, stale, or invalid item rejects the batch atomically.
- Local-midnight and DST-boundary behavior is covered by tests.
- Reminder reschedule/cancel is idempotent; queue failure is observable and does not undo the
  committed task update.
- After success, Today and Inbox agree without an app restart; after failure, retry is
  available.
- Existing task CRUD, toggle, exact-day, ownership, and notification tests pass.

The complete product and engineering contract remains in `0001`; this task does not reduce it.

## Non-functional and engineering constraints

- Follow the vertical path DTO -> controller -> service -> shared contract -> mobile
  hook/component -> tests -> docs.
- Use `JwtAuthGuard`, `@CurrentUser()`, and service-level ownership checks; never accept a
  caller-supplied `userId`.
- PostgreSQL/Prisma remain the source of truth. Add a schema/index migration only with proven
  need and document rollback.
- Preserve existing React Query and BullMQ conventions; do not put PII in logs or push data.
- Do not perform a broad TasksService/repository/event-bus refactor.
- Check the actual Free-tier batch ceiling in shared types and `PlanService`; correct ADR-008
  if it contains an outdated value.

## Claude Code work plan

1. After reading the context, write a short plan listing files, risks, and tests.
2. Implement the backend contract and tests.
3. Implement the mobile flow and tests.
4. Update only affected engineering documentation and factual ADR details.
5. Run typecheck, lint, and focused/regression tests. Do not declare completion while a quality
   gate is failing.

## Completion report

In the final report, include:

- changed files and behavior;
- verification commands and results;
- completed acceptance criteria;
- updated ADR and Engineering Handbook sections;
- known risks and remaining gaps.

If implementation requires a new product decision or a change to the Product Bible, stop and
request a Product Owner decision.
