# Implementation Package 0001: Guilt-Free Recovery

Status: proposed; not implemented.

This package is intentionally limited to one vertical slice. It does not authorize source-code changes.

## Step 1: Current State Analysis

### Existing documentation

- `Product-Bible/AI/Operating-System.md` is the current AI operating manual. It requires evidence-first analysis, explicit scope, separation of policy/plan/fact, and stopping when a product or architecture decision is unresolved.
- `Product-Bible/Product-Bible.md` defines the boundary between product intent and engineering facts. `Product-Bible/00-Constitution.md`, `01-Vision/Product-Vision.md`, and `User-Bible.md` contain the most substantive product direction.
- The remaining Product Bible documents are mostly structured outlines with headings for UX, ADHD support, experience, Smart Planner, roadmap, measurement, and decisions. `docs/research/user-problem-hypotheses.md` supplies the clearest current MVP hypothesis.
- `docs/Engineering-Handbook-v5.md` is the current engineering operating reference. `System-Bible.md`, `Developer-Bible.md`, `AI-Bible.md`, API/architecture/database/frontend/deployment docs, and ADR-001 through ADR-007 describe current boundaries and workflows.
- `docs/ai/IMPLEMENTATION_STATE_v2.md` and `NEXT_STEPS_v2.md` are working status/roadmap notes. They are useful evidence but are stale in places and must not override source code.
- `docs/research/19-architecture-risk-report.md` and `docs/Technical-Debt-Roadmap.md` identify security, coupling, observability, test, and delivery risks.

### Existing implementation

- Backend: NestJS modules for auth, users, tasks, routines, notifications, plan, and Prisma; PostgreSQL is the durable source of truth.
- Task model: user-owned tasks support scheduling, duration, completion, subtasks, recurrence flags/rules, and notification linkage. `TasksService.findAll` has timezone-aware exact-day filtering.
- Task lifecycle: create/update/toggle/delete exist; task writes attempt to synchronize one BullMQ reminder. Ownership checks exist on task reads and mutations.
- Recurrence: the schema and mobile form store `isRecurring`/RRULE values, but there is no occurrence materialization, skip-occurrence, or edit-occurrence behavior. `Routine` CRUD is not connected to generated task instances.
- Notifications: Redis/BullMQ queue, delayed jobs, retry/backoff, dedupe job IDs, Expo token registration, push sending, and `NotificationLog` exist. The implementation is not launch-proven: local scheduling, reboot recovery, permission settings, multi-device handling, provider timeouts, and verified device delivery are missing.
- Mobile: Expo Router screens exist for auth, onboarding, today, task form, focus placeholder, settings, and paywall. React Query owns server state; Zustand/SecureStore own session state.
- Today experience: day navigation, timeline, now/next, progress, empty states, quick add, inbox, optimistic completion, and task editing exist. The screen only loads the selected day, so incomplete tasks from prior days are not surfaced as a recovery path.
- Tests: focused API service/processor tests and a notification integration test exist. There is no mobile recovery test suite, no critical auth/plan end-to-end coverage, and no verified smoke path for a real device.

### Missing product capabilities

- Guilt-free return after a missed day: detect overdue work, show a neutral recovery choice, and reschedule selected work without forcing cleanup first.
- Complete recurring-task semantics and occurrence visibility.
- Launch-grade reminders (local/remote delivery, permission states, cancellation, reboot and multi-device behavior).
- Offline cache/outbox/conflict handling.
- Smart Planner, overload/recovery modes beyond the basic recovery slice, evening reset, and real Focus/body-doubling runtime.
- Production billing verification, themes, and other later roadmap items.

### Missing engineering capabilities

- A production-safe entitlement boundary: the current `/plan/upgrade` route is a development endpoint with no payment proof (Critical risk C-01/C-02).
- Complete auth hardening: secure OAuth randomness, provider transport timeouts/redaction, explicit account-linking policy, and broad regression coverage.
- Reliable external HTTP and push observability: no shared timeout policy, structured metrics, or full delivery/recovery runbook.
- Clearer domain boundaries: `TasksService` directly owns CRUD, plan checks, Prisma access, and notification side effects; mobile `today.tsx` and `task-form.tsx` are oversized.
- Stronger contracts: API date mappers, dependency-direction checks, CI quality gates, migration/rollback discipline, and production deployment/backup evidence.
- Recovery-specific API, ownership, timezone, transaction, and mobile-state tests.

## Step 2: Highest-Priority Missing Feature

The next feature should be **Come Back Without Guilt: an explicit overdue-task recovery and rescheduling flow**.

Why this is next:

1. It is already named as a P0 core UX item in `docs/ai/NEXT_STEPS_v2.md`; this is prioritization of an existing commitment, not a new idea.
2. The MVP hypothesis in `docs/research/user-problem-hypotheses.md` is "timeline + soft rescheduling." Its job-to-be-done explicitly includes returning after a day breaks down.
3. The Vision and User Bible make return, agency, neutral rescheduling, and a visible next step central outcomes. Constitution Articles 1, 4, 6, 8-12, 14-15, and 20-23 directly constrain this behavior.
4. The current implementation has enough readiness for a bounded vertical slice: authenticated task ownership, timezone-aware day projection, task CRUD, React Query, and existing reminder synchronization are present.
5. It closes a visible product failure: after a missed day, the user can open Today and see neither the unfinished work nor a respectful way forward. This is more central to Focus's promise than adding another planning surface.
6. It is smaller and more reversible than offline sync, full reminder reliability, Smart Planner, or recurrence materialization, while still creating MVP value and exposing the right contracts for later features.

This feature must not auto-rewrite a user's plan. It is a user-confirmed recovery action with an explicit preview.

## Goal

When a user returns to Today after missing scheduled tasks, Focus should surface a calm, actionable recovery entry and let the user move only the tasks they choose to an explicitly reviewed next place in the plan.

## User Problem

The current exact-day query excludes incomplete tasks whose scheduled time is in the past. The user therefore loses context, may duplicate work, or faces the day as if the missed commitment does not exist. There is no bulk, neutral, user-controlled path from "I missed this" to "here is what I choose to do next."

## Product Context

- Vision: help a person continue after a broken day, not achieve an ideal schedule.
- User Bible: the desired person can return, reduce, move, or cancel without turning a miss into identity or debt.
- Constitution: preserve adult agency; never use shame, guilt, punishment, hidden changes, or false certainty; make the next step visible.
- MVP research: the minimum response to "lost the day" and "overload" is a timeline plus soft rescheduling.
- Roadmap: Phase 1 dependable day planning includes recovery; Smart Planner/AI is later and must not be a dependency.

## Functional Requirements

1. The API identifies overdue root tasks for the authenticated user: scheduled before the start of the current local day, incomplete, owned by the user, and not subtasks. Unscheduled inbox tasks, completed tasks, future tasks, and tasks on a historical screen are excluded.
2. Day boundaries use the user's IANA timezone and existing date projection rules, including DST boundary tests.
3. On Today only, when overdue tasks exist, mobile shows one neutral recovery entry before the timeline. Opening the entry never mutates data and does not require reviewing the whole backlog.
4. The user can select a subset, inspect the proposed destination for every selected task, cancel, or confirm. Unselected tasks remain unchanged.
5. The first slice supports explicit per-task destinations: a valid future/today `startTime`, or `null` to intentionally return the task to Inbox. The UI may offer a bulk shortcut, but the resulting mapping must be visible before confirmation.
6. The backend validates that every selected task belongs to the caller, is still overdue/incomplete, and has a valid destination. Invalid or mixed-ownership input fails atomically.
7. A confirmed operation updates only selected task scheduling fields in one transaction and preserves title, duration, color, recurrence metadata, parent relation, and completion state.
8. After commit, changed tasks synchronize their reminder state through the existing notification boundary. A future time schedules a reminder; `null` or completed state cancels it. Secondary queue failure must be observable without rolling back the committed task change.
9. Successful mutation invalidates the relevant React Query keys so Today, Inbox, and the recovery entry agree. Failed network mutations leave server state intact and present a retryable error.
10. Repeating the same confirmed request is safe: already-rescheduled tasks produce no duplicate task changes or reminder deliveries.
11. All recovery copy remains neutral and adult: no streak, overdue shaming, moral score, forced explanation, or automatic "make-up" schedule.

## Non-functional Requirements

- Security: JWT identity and service-level ownership checks; no caller-supplied `userId`; validated UUIDs and ISO timestamps; no task details in logs or push payloads beyond the existing allowlist.
- Correctness: server owns timezone interpretation and serialized date contracts; no client-local date arithmetic may silently change the meaning of a task.
- Consistency: task updates are atomic; reminder work is a derived, idempotent side effect with bounded failure handling.
- Performance: one recovery read and one bounded mutation for the normal case; avoid N+1 ownership checks; support at least the current Free-tier task ceiling without an unbounded payload.
- UX/accessibility: calm hierarchy, clear current choice, accessible touch targets, readable date/time preview, keyboard/screen-reader labels, and no blocking setup before the user can continue.
- Resilience: Redis/provider failure does not erase a user's accepted reschedule; the UI communicates incomplete reminder synchronization without implying the task update failed.
- Observability: record outcome, counts, latency, and failure class without titles, tokens, or other PII.

## Acceptance Criteria

- A user in an IANA timezone with an incomplete task scheduled before local today sees the recovery entry on Today; a user with no such task does not.
- Opening Today or the recovery entry never changes a task.
- The user can select one overdue task, preview a destination, cancel, and verify that no field changed.
- The user can select multiple overdue tasks, confirm a mixed destination mapping, and verify that only those tasks changed.
- A destination of `null` visibly means "move to Inbox"; it is never an implicit fallback.
- A task from another user, a completed task, a future task, an invalid timestamp, or an empty selection is rejected with no partial writes.
- Date boundaries are correct at local midnight and across a DST transition; the same instant is not classified differently by server timezone.
- A changed task's reminder is rescheduled or cancelled exactly once; queue failure leaves the task mutation committed and produces an observable failure.
- After success, Today and Inbox reflect the result without an app restart. After a failed request, the previous view remains recoverable.
- Existing task create/update/toggle/delete, exact-day filtering, ownership, and notification tests remain green.
- Product review confirms the flow helps a missed-day return without shame, hidden changes, or an imposed priority.

## Out of Scope

- Recurring occurrence generation, skip/edit occurrence, or Routine-to-Task materialization.
- Full local/remote notification launch readiness, reboot recovery, multi-device sync, or offline outbox/conflict resolution.
- Smart Planner, AI decomposition, automatic prioritization, energy inference, or silent replanning.
- Evening review, historical recovery analytics, streaks, body doubling, themes, billing, or new medical/diagnostic behavior.
- A broad TasksService/repository/event-bus refactor. Keep this slice compatible with current boundaries.

## Engineering Constraints

- Follow the existing vertical slice: DTO -> controller -> service/module -> shared contract -> mobile API/hook -> screen/component -> tests -> docs.
- Use `@CurrentUser()` plus `JwtAuthGuard`; enforce ownership in the service even when the query already scopes by user.
- Keep PostgreSQL/Prisma as source of truth. Add no schema column unless an unresolved product decision proves it necessary; consider a composite index only with evidence and a named migration.
- Add recovery routes before `GET /tasks/:id` route matching, and document method/status/request/response/error behavior in `docs/API.md`.
- Keep server state in React Query. Do not put recovery task data in the auth/UI Zustand store and do not use raw axios/fetch in the screen.
- Reuse the existing notification job ID, retry, dedupe, and logging conventions. Do not put PII into push data.
- Do not change Product Bible policy or user-facing copy beyond the agreed recovery contract without Product Owner review. Mark the capability planned until implemented and verified.

## Risks

- A large recovery list can recreate overload. Mitigate with a bounded list, subset selection, one clear next action, and no automatic bulk mutation.
- Ambiguous time mapping can silently create impossible or surprising schedules. Require an explicit preview and resolve the mapping policy in an ADR before coding.
- Reminder synchronization can diverge after a successful task update. Keep it secondary, idempotent, logged, and retryable.
- Date/DST mistakes can classify tasks incorrectly. Centralize the projection and test boundary instants.
- Adding a route or hook without invalidation can leave contradictory Today/Inbox states. Define cache keys and invalidation in the contract first.
- The existing service coupling may tempt an unrelated refactor. Keep the feature isolated and record follow-up debt instead.

## Open Questions

1. For a bulk "move to today" shortcut, should the default preserve each task's local clock time, assign an explicit user-selected slot, or move tasks to Inbox? **Recommendation:** require an explicit preview and allow `null`/Inbox; do not silently preserve a past time.
2. Should recurring root tasks appear in this first recovery slice? **Recommendation:** exclude them until occurrence semantics exist, to avoid treating a series as one overdue task.
3. What maximum overdue-task count should be rendered at once, and should the API paginate beyond it? Use the current Free-tier ceiling as the initial bound unless evidence requires more.
4. Is an "undo" action required for the first release, or is cancel-before-confirmation sufficient? **Recommendation:** defer post-commit undo unless research or Product Owner makes it launch-critical.
5. Which exact Russian copy and event names are approved? Product Owner owns this decision; engineering must not invent moral or medical language.

## Recommended Architecture

1. Add a small recovery use case inside the existing tasks module (for example `TaskRecoveryService`) rather than expanding the mobile screen or performing a cross-domain refactor.
2. Add typed DTOs for the recovery query and reschedule command. A command should carry an array of `{ taskId, targetStartTime }`, where `targetStartTime` is an explicit ISO value or `null` for Inbox.
3. Add authenticated routes such as `GET /tasks/recovery?date=YYYY-MM-DD` and `POST /tasks/recovery/reschedule`. The response should include the user timezone, overdue task data needed for the preview, and updated tasks; errors should distinguish validation, ownership, stale-overdue state, and secondary reminder failure.
4. In the service, load and validate all selected records in one ownership-aware query, execute the task updates in a Prisma transaction, then synchronize reminders after commit. Preserve the existing primary-write/secondary-effect failure rule.
5. On mobile, add `useOverdueTasks` and `useRescheduleOverdueTasks` to `lib/api/tasks.ts`, a focused recovery banner/sheet component, and Today integration that runs only for the current date. Keep selection and preview state local to the feature component.
6. Define and document React Query keys/invalidation for recovery, Today, and Inbox. Use an explicit pending/confirm/error state; do not rely on optimistic mutation for a multi-task transaction until rollback behavior is tested.
7. Prefer existing `[userId, startTime]` indexing initially. Measure the recovery query; add a named composite index/migration only if evidence shows the completed-state predicate needs it.

## Relevant Engineering Handbook Sections

- Section 2 Product and system model: task truth versus day projection and user outcome.
- Section 6 Data-flow map: synchronous task mutation and asynchronous reminder side effect.
- Section 7 Architecture and ADR: boundary ownership and decision traceability.
- Section 8 Domain lifecycles: Task and Notification invariants.
- Section 9 API/backend/frontend: vertical-slice placement, contracts, cache, and error behavior.
- Section 10 Authentication and security: JWT, `@CurrentUser()`, ownership, validation, and privacy.
- Section 11 Database: Prisma source of truth, indexes, migrations, and timezone/date rules.
- Section 14 Safe architecture changes: characterization, additive contracts, compatibility, and rollback.
- Section 15 Safe feature delivery: contract/schema -> policy -> controller -> worker -> client -> tests -> docs and Definition of Done.
- Section 16 AI workflow: evidence, minimal diff, explicit unknowns, and implemented/planned/incomplete status.
- Section 17 Risks and technical debt: task/notification coupling, date typing, observability, and test gaps.
- Sections 22.2-22.7: concrete feature placement, auth/data flow, database/risk review, and documentation sufficiency.

## Required ADRs

- **ADR-008: Overdue-task recovery semantics.** Record the overdue definition, timezone/DST rules, explicit destination mapping, recurring-task treatment, atomicity, stale-task behavior, and no-silent-replanning rule.
- **Update ADR-006** only if reminder scheduling/cancellation behavior or job contracts change; otherwise cite it from ADR-008 and keep the existing notification decision intact.
- If the query requires a new composite index or schema field, record the migration and rollback decision in the same ADR or a narrowly scoped follow-up ADR.

## Testing Requirements

- Backend unit tests for local-day boundaries, DST, overdue filtering, empty/invalid selections, recurring exclusion, ownership, stale state, transaction atomicity, and explicit `null`/future destinations.
- Backend integration/e2e tests for authenticated recovery read and mutation, foreign-task rejection, mixed valid/invalid batches, reminder reschedule/cancel, queue failure after commit, and idempotent repeat submission.
- Mobile tests for no-banner/one-banner states, selection, preview, cancel, confirm, loading, error/retry, query invalidation, and no mutation on screen open.
- Regression tests for existing task CRUD, timezone exact-day filtering, optimistic completion, and notification dedupe.
- Manual smoke flow on an authenticated device/emulator: create yesterday's task -> open Today -> review recovery -> cancel -> reopen -> confirm destination -> verify Today/Inbox and reminder state.

## Documentation Updates

After implementation and verification, update only affected facts:

- `docs/API.md`: recovery endpoints, DTOs, status codes, errors, ownership, and cache keys.
- `docs/Backend.md`, `docs/Architecture.md`, and Engineering Handbook v5 sections 6/8/9: recovery data flow and reminder side effect.
- `docs/ADR/ADR-008-overdue-task-recovery.md` and, if applicable, ADR-006.
- `docs/ai/IMPLEMENTATION_STATE_v2.md` and `NEXT_STEPS_v2.md`: move the item from planned to implemented only with evidence.
- `Product-Bible/09-Roadmap/Feature-Roadmap.md` or the relevant product decision record only if its status/evidence changes; do not add new product meaning.
- `docs/research/19-architecture-risk-report.md`/`Technical-Debt-Roadmap.md` only if the implementation resolves or creates a documented risk.
