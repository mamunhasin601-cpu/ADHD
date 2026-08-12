# ADR-008: Overdue-Task Recovery Semantics

**Status:** accepted — implemented  
**Date:** 2026-08-04  
**Author:** Claude Code (Lead Software Engineer)  
**Package:** 0001-guilt-free-recovery
**Owners:** Product Owner (product intent), Lead Software Engineer (engineering contract)

---

## Context

The current `TasksService.findAll` applies an exact-day window filter: tasks are returned only
if their `startTime` falls within `[dayStart, dayEnd]` in the user's IANA timezone. Incomplete
tasks whose `startTime` is in a prior day are therefore invisible on Today.

This creates a product failure: a user returning after a missed day sees neither the unfinished
work nor a respectful way forward. There is no bulk, neutral, user-controlled path from
"I missed this" to "here is what I choose to do next."

Implementation Package0001 defines a bounded vertical slice that surfaces overdue tasks on
Today and lets the user select destinations via an explicit, previewed, user-confirmed operation.

Before any code is written, the following semantic decisions must be recorded so that the
implementation, tests, and future maintainers share one unambiguous contract.

This ADR records those decisions. It does not record product intent (owned by Product Bible /
Product Owner) or UI copy (owned by Product Owner). It records the engineering trade-offs and
their consequences.

---

## Decisions

### D-1: Definition of "overdue task"

A task is overdue for a given user at a given instant if and only if all of the following
conditions are true simultaneously:

1. `task.userId = caller.id` — owned by the authenticated caller.
2. `task.parentTaskId IS NULL` — root task only; subtasks are excluded.
3. `task.completedAt IS NULL` — not yet completed.
4. `task.isRecurring = false` — recurring root tasks are excluded in the first slice (see D-5).
5. `task.startTime IS NOT NULL` — must have a scheduled time.
6. `task.startTime < localDayStart(user.timezone, referenceInstant)` — scheduled strictly
   before the start of the current local day in the user's timezone.

"Current local day" is computed on the server using the user's stored `timezone` field
(IANA format, e.g. `"Europe/Moscow"`). The reference instant is the moment the
`GET /tasks/recovery` request is processed. The client supplies an optional
`date=YYYY-MM-DD` parameter only to identify which day is "today" for display purposes;
the server recomputes the boundary from the live clock and the stored timezone.

**Excluded regardless of the above:**
- Unscheduled inbox tasks (`startTime IS NULL`)
- Completed tasks (`completedAt IS NOT NULL`)
- Future tasks (`startTime >= localDayStart`)
- Subtasks (`parentTaskId IS NOT NULL`)
- Recurring root tasks (first slice; see D-5)
- Tasks on a historical navigation screen (recovery entry is shown only when `date` equals
  the current local date)

### D-2: Timezone and DST boundary rules

The server is the sole authority on timezone interpretation. No client-local date arithmetic
may silently change the meaning of a task.

Rules:

- `localDayStart(tz, instant)` is computed with `toDate(\`\${YYYY-MM-DD}T00:00:00\`, { timeZone: tz })`
  from `date-fns-tz`, matching the existing convention in `TasksService.findAll`.
- The date string `YYYY-MM-DD` is derived from the reference instant converted to the user's
  timezone. The server never trusts a client-supplied wall-clock date to define the
  overdue boundary.
- During a DST "spring forward" gap the missing local hour is treated as non-existent; a task
  scheduled in the gap is compared against the UTC equivalent. No task can be permanently
  unclassifiable: the gap produces at most a 1-hour window of edge ambiguity that resolves to
  the correct side once the transition completes.
- During a DST "fall back" repeat, the server uses the first occurrence of the ambiguous
  hour (pre-transition offset) as the boundary, consistent with `date-fns-tz` defaults.
- DST boundary instants must be covered by dedicated unit tests (see Testing section of
  Implementation Package 0001).

### D-3: Explicit destination mapping contract

The reschedule command carries an explicit mapping array. There is no implicit, bulk, or
clock-preserving default.

```
POST /tasks/recovery/reschedule

Body:
{
  "items": [
    { "taskId": "<uuid>","targetStartTime": "<ISO-8601 UTC string>" },
    { "taskId": "<uuid>",  "targetStartTime": null }
  ]
}
```

Semantics:

- `targetStartTime` is an **absolute ISO-8601 instant** with an explicit `Z` or numeric `±HH:MM`
  offset (e.g. `"2026-08-10T14:00:00.000Z"` or `"2026-08-10T17:00:00+03:00"`).
  Date-only values and offsetless datetimes are ambiguous and rejected at the DTO boundary
  (HTTP 400, `@Matches(ABSOLUTE_ISO_INSTANT)`).
  The value must be **strictly later than the service `referenceInstant`** (i.e. `dest >
  referenceInstant`). Equal-to-now and any past instant — including times that already passed
  earlier today — are rejected with HTTP 422 Unprocessable Entity.
- `targetStartTime` is `null` → task is intentionally moved to Inbox (`startTime` set to `null`).
  This is never an implicit fallback; the UI must show "Move to Inbox" explicitly before
  the user confirms.
- A missing `targetStartTime` key (absent, not `null`) is rejected by the DTO with HTTP 400.
  Absence is never treated as "move to Inbox".
- An empty `items` array is rejected with HTTP **400** on the real route: `@ArrayNotEmpty` in
  `RescheduleRecoveryDto` fires inside the global `ValidationPipe`, before the service runs.
  The service keeps its own `UnprocessableEntityException` (422) guard as defence in depth for
  direct service calls, so both statuses exist by design at different layers.
- An `items` array exceeding the Free-tier task ceiling (current: 50 tasks as defined in
  `FREE_TIER_LIMITS.maxActiveTasks` from `@focus/shared-types`, consistent with
  `PlanService.enforceTaskLimit`) is rejected with HTTP **400** via `@ArrayMaxSize`.
- The mapping is visible to the user before confirmation. The backend does not infer, reorder,
  or redistribute tasks silently.

Verified status mapping on the real HTTP route (see
`apps/api/src/tasks/tasks.controller.recovery.http.spec.ts`):

| Condition | Status |
|---|---|
| valid absolute ISO destination, or explicit `null` | 200 |
| `reminderSyncStatus: "partial"` (task commit succeeded) | 200 |
| missing / malformed / empty-string `targetStartTime` | 400 |
| date-only or offsetless datetime `targetStartTime` | 400 |
| invalid `taskId` UUID, empty `items`, oversized `items` | 400 |
| unknown field in body or item (`forbidNonWhitelisted`) | 400 |
| foreign or non-existent task | 403 |
| stale recovery state (`code: STALE_RECOVERY_STATE`) | 409 |
| destination ≤ service `referenceInstant` (including equal-to-now) | 422 |

### D-4: Atomicity and reminder side-effect contract

Task updates and reminder synchronization follow the existing primary-write / secondary-effect
pattern established in `TasksService.syncReminder` and ADR-006.

```
┌───────────────────────────────────────────────────┐
│  Prisma transaction (atomic)                      │
│  • UPDATE task SET startTime = ... WHERE id IN ...│
│  • All items or none                │
└───────────────────────────────────────────────────┘│ commit▼
┌───────────────────────────────────────────────────┐
│  syncReminder loop (non-atomic, idempotent)       │
│  • schedule or cancel BullMQ job per task         │
│  • failure is logged, NOT rolled back             │
│  • response signals incomplete sync if any fail   │
└───────────────────────────────────────────────────┘
```

Rules:

- The Prisma transaction is all-or-nothing. Any validation failure (ownership, stale state,
  invalid destination) aborts the entire batch with no partial writes.
- Reminder synchronization runs after commit, outside the transaction.
- A BullMQ or Redis failure after a committed task update does not roll back the task change.
  The task is correctly rescheduled in the database; only the push notification may be delayed
  or missing.
- The response body distinguishes `taskUpdateStatus: "ok"` from
  `reminderSyncStatus: "partial" | "ok"` so the mobile client can surface incomplete
  reminder sync without implying the task update failed.
- Job IDs follow the existing convention: `task-reminder-<task.id>`. Scheduling a reminder
  for a task that already has one replaces it (BullMQ `upsert` semantics via deterministic
  job ID). This makes reminder sync idempotent for repeated equal calls.

### D-5: Recurring-task exclusion (first slice)

Recurring root tasks (`isRecurring = true`) are excluded from the overdue recovery query in
this slice.

Rationale: the schema stores `isRecurring` and `recurrenceRule` (RRULE string) on the root
task, but there is no occurrence materialization, skip-occurrence, or edit-occurrence
mechanism. Treating a recurring root task as a single overdue task would create incorrect
semantics: rescheduling the root would shift all future recurrences, not just the missed
instance.

Consequence: a recurring task that was missed is not surfaced in the recovery entry until
occurrence semantics exist. This is a known capability gap, recorded in
`docs/Technical-Debt-Roadmap.md` and in Implementation Package 0001 under "Out of Scope."

The exclusion is enforced both in the query (`isRecurring: false`) and in service-level
validation so that a stale or inconsistent `isRecurring` flag cannot bypass the guard.

### D-6: Stale-task validation

The POST handler re-validates each item at mutation time against the same overdue criteria
used in GET. This prevents a race condition where a task is completed, rescheduled, or
deleted between the GET and the POST.

If any item in the batch is no longer overdue (was completed, already rescheduled to a future
time, deleted, or does not belong to the caller) the entire batch is rejected with HTTP 409
Conflict. No partial write is performed.

The client should treat HTTP 409 as a signal to invalidate the `recovery` query key and
re-fetch before allowing a retry.

### D-7: No-silent-replanning rule (engineering enforcement)

The service layer must never compute, infer, or assign a destination without an explicit
entry in the request `items` array. The mapping must be 1:1 between request items and
updated tasks. Any discrepancy (more tasks updated than items provided, or fewer) is a
programming error and must throw an internal assertion rather than silently succeed.

This rule is the engineering enforcement of the product principle:
"Focus does not rewrite the user's plan. It waits for an explicit user-confirmed action."

### D-8: Security contract

- Routes use `@UseGuards(JwtAuthGuard)` and `@CurrentUser()`. No caller-supplied `userId`
  is accepted.
- Ownership of every `taskId` in the request is verified in one batched ownership query
  before any write. A single foreign `taskId` rejects the entire batch with HTTP 403
  Forbidden.
- UUIDs are validated via `ParseUUIDPipe` or class-validator `@IsUUID()`.
- ISO timestamps are validated via class-validator `@IsISO8601()`. Out-of-range or
  unparseable values return HTTP 400.
- Task titles, colors, user IDs, task IDs, and other user-owned content are never included in
  Recovery logs, push payloads, or error responses. Recovery log lines record only outcome,
  operation counts, `latencyMs`, `reminderSyncStatus` where applicable, and `failureClass`
  where applicable. Counts and error codes are the only aggregated observables.

### D-9: Route placement and naming

Recovery routes are registered **before** the parameterised `GET /tasks/:id` route in the
NestJS controller to prevent`:id` matching the literal string `"recovery"`.

```
GET  /tasks/recovery?date=YYYY-MM-DD→ list overdue tasks for current local day
POST /tasks/recovery/reschedule         → confirm a destination mapping
```

Both routes are documented in `docs/API.md` before the parameterised routes section.

### D-10: React Query cache key contract

Two new cache keys are defined:

```ts
['tasks', 'recovery', dateParam]// GET /tasks/recovery result
['tasks', dateParam]                   // existing Today key (invalidated on success)
['tasks', 'inbox']// Inbox key (invalidated when any item → null)
```

On successful POST:
- `['tasks', 'recovery', dateParam]` is invalidated.
- `['tasks', dateParam]` (Today) is invalidated.
- `['tasks', 'inbox']` is invalidated if any item had `targetStartTime: null`.

On HTTP 409 (stale):
- `['tasks', 'recovery', dateParam]` is invalidated and re-fetched.
- No mutation of local state; the previous view remains intact for the user.

Optimistic updates are deferred for the first slice. A multi-task transaction with a
possible409 stale-state path requires tested rollback behavior before optimistic writes
are safe.

---

## Alternatives Considered

### A-1: Expand `GET /tasks?date=...&includeOverdue=true` instead of a new route

**Rejected.** Adding an `includeOverdue` flag to the existing endpoint would blend two
distinct query semantics into one response, complicate the existing pagination/filter
contract, and make it harder to add recovery-specific response fields (user timezone,
overdue count, stale-state signal). A dedicated sub-resource is more explicit and keeps
the existing `GET /tasks` contract stable.

### A-2: Auto-reschedule overdue tasks to today on app open

**Rejected.** Violates Product Constitution Articles 8–12 (agency, no hidden changes,
no automatic replanning). This alternative was excluded by product decision before
engineering was consulted.

### A-3: Allow bulk "move all to today preserving clock time"

**Rejected for first slice.** Moving a task from yesterday's09:00 to today's 09:00 silently
creates a valid-looking but semantically unreviewed schedule. The spec requires an explicit
preview per item. A bulk shortcut may be added later if the UI makes the resulting mapping
visible before confirmation (see Open Question1 in Implementation Package 0001).

### A-4: Use a separate `RecoveryTask` Prisma model

**Rejected.** No new schema column is needed. The overdue state is fully derivable from
existing `startTime`, `completedAt`, `isRecurring`, `parentTaskId`, and `userId` fields.
Adding a column for a derived, transient UI state would add migration risk and ongoing
sync overhead.

### A-5: Deferundo (post-commit) for first slice

**Accepted.** Cancel-before-confirmation is the recovery mechanism for the first slice.
Post-commit undo requires a separate inverse operation, tested rollback semantics, and a
time-bounded undo window decision. Deferred unless Product Owner marks it launch-critical.

---

## Consequences

**Positive:**
- Overdue detection is deterministic and testable: a fixed instant and a timezone produce
  an unambiguous boundary.
- The transaction/side-effect split preserves the existing reliability guarantee from ADR-006:
  a queue failure cannot erase a committed task reschedule.
- Explicit destination mapping prevents surprise schedule mutations and keeps product intent
  (adult agency, no silent replanning) enforced at the service layer.
- Recurring-task exclusion prevents incorrect semantics until occurrence materialization exists.

**Negative / trade-offs:**
- Recurring overdue tasks are invisible in the first slice. Users with recurring tasks that
  were missed will not see a recovery path until occurrence semantics are implemented.
- The 1:1 batch validation (all-or-nothing on stale state) means a single raced completion
  rejects the whole batch. The client must handle HTTP 409 gracefully.
- Deferring optimistic updates means the UI shows a loading state during the POST. Acceptable
  for a multi-task transaction; revisit if UX research shows it creates cognitive friction.

**Engineering debt created:**
- Occurrence-aware recovery (skip/edit instance for recurring tasks) is deferred and must be
  tracked in `docs/Technical-Debt-Roadmap.md`.
- Post-commit undo is deferred and must be evaluated in Phase 2.
- Paginated recovery list (beyond Free-tier ceiling) is deferred; the current ceiling is the
  implicit bound.

---

## Relationship to other ADRs

| ADR | Relationship |
|-----|-------------|
| ADR-003 (Prisma/PostgreSQL) | Recovery query and transaction use Prisma as source of truth; no new schema columns in first slice |
| ADR-004 (JWT auth) | Recovery routes use `JwtAuthGuard` + `@CurrentUser()`; ownership enforced in service |
| ADR-005 (Expo Router / React Query) | Cache key contract (D-10) extends the existing React Query state model |
| ADR-006 (BullMQ/Redis/Expo Push) | Reminder sync after recovery commit follows the same primary-write/secondary-effect rule; job ID convention preserved |

ADR-006 is not updated: the notification scheduling contract is unchanged. This ADR cites
ADR-006 and adds recovery-specific consequences only.

---

## Implementation guidance (non-normative)

This section summarises the agreed architecture from Implementation Package 0001 to help
the implementer align with this ADR. It is not authoritative; the Package is the
authoritative engineering spec.

- Add `TaskRecoveryService` inside the existing `tasks` module. Do not create a new module.
- DTOs: `GetRecoveryQueryDto` (optional `date: string`), `RescheduleItemDto` (`taskId: UUID`,
  `targetStartTime: ISO string | null`), `RescheduleRecoveryDto` (`items: RescheduleItemDto[]`).
- Route order in controller: `GET /tasks/recovery` and `POST /tasks/recovery/reschedule`declared before `GET /tasks/:id`.
- Service method `getOverdueTasks(userId, referenceDate?)` — returns overdue task list.
- Service method `rescheduleOverdueTasks(userId, items)` — ownership batch check, Prisma
  transaction, syncReminder loop, structured response.
- Do not add `isRecurring: false` as a permanent column default; apply it only as a query
  filter until recurring semantics are designed.
- `toDate` from `date-fns-tz` is the only approved method for IANA-timezone day-boundary
  computation in this codebase.

---

## Status history

| Date | Status | Author | Note |
|------|--------|--------|------|
| 2026-08-04 | accepted — pre-implementation | Claude Code | Created per Implementation Package 0001 requirement |
| 2026-08-04 | accepted — implemented | Claude Code | Full vertical slice delivered: backend (TaskRecoveryService, 2 routes, DTOs), mobile (RecoveryBanner, useOverdueTasks, useRescheduleOverdueTasks, today.tsx integration), timezone fix (localDayStart-based 09:00 computation) |
| 2026-08-05 | accepted — implemented, acceptance verified | OpenCode | Acceptance passes 0007, 0007A, 0007B, 0007C. D-3 corrected: destination must be an **absolute ISO-8601 instant** with explicit `Z` or `±HH:MM` offset; strict `dest > referenceInstant` (not `>= localDayStart`); date-only/offsetless datetime rejected at DTO (HTTP 400). Canonical `toCanonicalDateParam` date key aligns Today, Recovery, and invalidation. Today-only guard: RecoverySection renders null on non-today dates regardless of timezone validity. Two-user authenticated integration suite (real JwtAuthGuard + JwtStrategy + TaskRecoveryService). Recovery log lines contain outcome/counts/failure-class only — no userId, taskId, or titles. Verified: API **160 passed / 10 suites**, mobile **168 passed / 6 suites**. API e2e and device smoke NOT run (no Redis/PostgreSQL/Docker in this environment). |