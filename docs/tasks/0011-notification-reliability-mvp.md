# Implementation Package 0011: Notification Reliability MVP

**Status:** ready for autonomous implementation  
**Priority:** P0 / Release A launch blocker  
**Source:** Product roadmap, ADR-006, Engineering Handbook v5, and current implementation review

## Goal

Make task reminders dependable enough for the MVP: a user can schedule a task, receive one
privacy-safe reminder on an authenticated device, survive an app/device restart, and stop the
reminder when the task is moved, completed, or deleted. The existing BullMQ/Redis/Expo skeleton
must become a verified local-plus-remote reminder flow rather than an unproven side effect.

## User Problem

Focus currently stores task times and has partial server-side queue code, but a user cannot rely on
the product to prompt them at the right moment. Permission denial, token lifecycle, app restart,
stale local schedules, multi-device tokens, and provider failures are not handled as one coherent
user-visible flow. A missed prompt can recreate the same uncertainty and avoidance that the product
is meant to reduce.

## Product Context

- The Release A roadmap identifies Local + Remote Notifications as the next major P0 blocker after
  Today, Inbox, onboarding, auth, plan limits, and Guilt-Free Recovery.
- Product Constitution and User Bible require adult agency, rare and reliable reminders, no shame or
  punitive escalation, and no sensitive task details in push text.
- Tasks remain the operational source of truth. Notifications are derived side effects and must not
  block or roll back task CRUD.
- ADR-006 already chooses BullMQ/Redis for delayed jobs and Expo Push for remote delivery. This task
  completes that decision's missing device and local-runtime boundaries; it does not replace them.

## Functional Requirements

### Device permission and token lifecycle

1. After authenticated bootstrap, mobile requests notification permission only through the OS flow.
   A denied permission produces a neutral, dismissible state and never loops or blocks Today/task
   CRUD.
2. On granted permission, mobile obtains a valid Expo push token and registers it through an
   authenticated, ownership-safe API boundary. Registration is idempotent.
3. The backend validates token shape and bounded length, supports explicit token removal, and never
   trusts a client-supplied user ID.
4. Replace the single `User.expoPushToken` assumption with a user-owned device-token record (or an
   equivalent design justified by an ADR) so two authenticated devices can register independently.
   A token is unique, revocable, and safe to delete on `DeviceNotRegistered`.

### Local reminder scheduling

5. For every future scheduled task on the device, mobile schedules at most one local notification
   at the task's absolute `startTime` using a deterministic identifier derived from the task ID.
6. Creating or editing a task reconciles its local reminder: future time schedules/reschedules it;
   null, completed, deleted, or past state cancels it.
7. Local notification content is generic and non-sensitive. It must not include task title, task
   notes, task ID, or other user-owned content on a locked device.
8. On authenticated app bootstrap and after permission becomes available, mobile reconciles future
   reminders from server task truth. Reconciliation is idempotent and bounded; it must not create
   duplicate local notifications.

### Remote reminder delivery

9. The existing server scheduling boundary remains post-commit and uses deterministic BullMQ job
   IDs, bounded retries, exponential backoff, and cancellation before replacement.
10. The worker sends an allowlisted generic Expo payload to every active device token for the user.
    Push text must not contain task titles, notes, IDs, or sensitive details.
11. A provider/network failure is retried according to the bounded policy and recorded with a safe
    failure class. `DeviceNotRegistered` revokes only the invalid device token.
12. Remote delivery is a secondary effect: task create/update/complete/delete succeeds even when
    Redis or Expo is unavailable. The API exposes an actionable but non-alarming status for partial
    reminder synchronization where the existing contract already supports it.
13. Completion, deletion, Inbox moves, and future-time changes cancel or replace both the server job
    and the local device schedule exactly once.

### User-facing behavior

14. Reminder permission and synchronization states are neutral, concise, and dismissible. No streak,
    overdue score, guilt copy, forced explanation, or repeated nagging is introduced.
15. Tapping a notification opens the existing task route or Today context without exposing a task
    payload in the push itself. If the task is stale or missing, the app lands safely on Today.

## Non-functional Requirements

- **Privacy:** no task title, notes, identifiers, access tokens, or sensitive user content in push
  payloads, local notification content, logs, or analytics events. Device tokens are treated as
  secrets and are never printed.
- **Correctness:** server task state is authoritative; local schedules are a recomputable cache.
  All times are absolute instants serialized as ISO-8601; no device-local arithmetic changes the
  meaning of a task time.
- **Reliability:** one reminder per device/task/start-time; retries are bounded; duplicate jobs and
  duplicate local schedules are harmless; Redis/Expo failure cannot erase a committed task change.
- **Performance:** bootstrap reconciliation is bounded to the next configurable horizon and does
  not issue an unbounded request or N+1 token queries.
- **Security:** all token registration/removal and task actions use JWT identity and ownership
  checks; DTOs reject unknown or oversized fields.
- **Accessibility:** permission/sync states are readable and actionable without requiring color or
  sound; notification behavior respects OS settings.
- **Observability:** record outcome, counts, latency, reminder status, and failure class without
  task/user identifiers or content. Distinguish local scheduling, queueing, provider response, and
  token revocation.

## Acceptance Criteria

1. A real authenticated device with permission granted receives exactly one local reminder for a
   future task at its absolute start time.
2. A task create/edit/completion/delete flow reconciles local and remote reminders without duplicate
   delivery or stale schedules.
3. App restart rehydrates the bounded future local schedule from server truth; reboot/relaunch does
   not duplicate notifications.
4. Two authenticated devices can register different tokens for one user; revoking one token does
   not disable the other.
5. Permission denied does not block task CRUD, does not loop, and does not create local schedules.
6. Remote queue/provider failure leaves the task mutation committed, retries only within the bounded
   policy, and exposes a safe partial/failure status where applicable.
7. `DeviceNotRegistered` removes only the invalid token and is covered by a regression test.
8. Push and local notification payload snapshots contain only the approved generic fields and no
   task/user content.
9. Authenticated API tests prove token ownership, invalid token rejection, removal, and foreign-user
   isolation.
10. API unit/integration suites, mobile typecheck, mobile tests, and API build pass.
11. A Redis/PostgreSQL-backed notification e2e test proves queue -> worker -> provider mock ->
    NotificationLog, retry behavior, deduplication, cancellation, and token revocation.
12. Manual device smoke proves: sign in -> grant/deny permission -> create future task -> receive
    local/remote reminder -> edit time -> complete/delete -> no stale reminder -> relaunch and verify
    reconciliation.
13. Product review confirms the flow is rare, neutral, privacy-safe, and does not turn reminders
    into pressure or punishment.

## Out of Scope

- Recurring-task occurrence generation and recurrence editing.
- Offline mutation outbox or general conflict resolution.
- Notification inbox/history UI, analytics dashboard, campaigns, or marketing pushes.
- Smart reminder timing, snooze, quiet-hours policy, escalation, streaks, or guilt-based copy.
- New push provider, web push, email/SMS reminders, or background serverless scheduler.
- Product Bible policy changes, monetization, themes, or unrelated auth hardening.

## Engineering Constraints

- Preserve NestJS module boundaries and the existing Tasks -> Notifications side-effect direction.
- Keep PostgreSQL as durable truth, Redis as coordination only, and React Query/Zustand boundaries
  unchanged.
- Use explicit DTOs and migrations for any device-token model; never use `db push` or rewrite applied
  migrations.
- Keep deterministic job IDs and idempotent cancel/reschedule semantics from ADR-006.
- Do not put task content in BullMQ payloads unless an ADR and privacy test prove it is necessary;
  prefer task/user IDs with worker-side allowlisted lookup, and do not log those IDs.
- Use existing Expo Notifications APIs and project configuration. Do not add a native dependency
  without documenting the platform requirement.
- Preserve existing Recovery behavior and all current API/mobile test contracts.

## Risks

- Expo development builds and OS permission behavior differ from Jest mocks; device smoke is
  mandatory for launch evidence.
- A device-token migration can invalidate existing tokens if backfill/removal is unsafe.
- Local and remote channels can duplicate reminders without a clear ownership/dedup strategy.
- Provider timeouts and Redis outages can create false confidence if only unit tests run.
- Generic locked-screen copy may be less informative; this is an intentional privacy tradeoff.
- Multiple devices increase fan-out and retry cost; bound token count and worker work per job.

## Open Questions

- What is the initial local reconciliation horizon (for example, today plus the next seven days)?
  Choose a bounded default and document it; do not block the core flow on product research.
- Should local and remote reminders both be enabled by default when permission is granted, or should
  one be the primary channel per device? The implementation must prevent duplicate user-visible
  reminders regardless of the choice.
- Which exact generic copy is acceptable in the user's locale while remaining non-sensitive?
- Is one NotificationLog row required per device attempt or per task-level delivery outcome?
- Which supported Expo SDK/platform combinations are launch targets, and which device matrix is
  available for smoke testing?

## Recommended Architecture

1. Add a user-owned `PushDevice`/`DeviceToken` model with token, platform, installation identifier,
   enabled/revoked timestamps, and unique constraints. Expose authenticated register/remove routes
   through the Users boundary.
2. Keep `Task` as truth. A shared reminder reconciler receives task state and calls two adapters:
   `LocalReminderScheduler` on mobile and `RemoteReminderScheduler` backed by NotificationsService.
3. On mobile bootstrap and task mutation success, fetch a bounded future task projection and reconcile
   deterministic local IDs. The reconciler cancels stale IDs before scheduling new ones.
4. On the API, queue a compact job containing only the minimum identifiers needed for worker lookup;
   worker loads allowlisted data, sends a generic Expo payload to active tokens, records safe outcome,
   and revokes invalid tokens.
5. Keep primary task writes separate from post-commit reminder effects. Return existing partial status
   semantics for secondary failures and never roll back a committed task because a provider is down.
6. Add one ADR for the device-token/local-vs-remote contract and update ADR-006 with the final retry,
   deduplication, privacy, and recovery rules.

## Relevant Engineering Handbook Sections

- Section 5: dependency map and boundary ownership.
- Section 6: task -> reminder data flow, queue/worker/provider separation, and observability.
- Section 8: Task and Notification lifecycle, derived side effects, and failure behavior.
- Section 9: API/backend/frontend contracts, React Query/server state, auth and ownership.
- Section 12: testing and verification gates.
- Section 14: migration and architecture change safety.
- Section 15: feature implementation workflow and Definition of Done.
- Section 17: Redis/provider/PII risks and hardening priorities.

## Required ADRs

- Update **ADR-006** with the implemented local/remote channel, token lifecycle, privacy-safe
  payload, retry/backoff, deduplication, cancellation, and unavailable-infrastructure evidence.
- Add **ADR-009: Device token and reminder channel contract** if a new token model or local/remote
  ownership boundary is introduced. Record alternatives and rollback/migration strategy.

## Testing Requirements

- API unit tests for token DTO validation, register/remove ownership, notification scheduling,
  cancellation, retry classification, generic payload allowlist, DeviceNotRegistered cleanup, and
  NotificationLog outcomes.
- API authenticated integration tests for two users and two devices, invalid/foreign tokens, and
  task mutation success when Redis/provider calls fail.
- Mobile unit tests for permission states, token registration, deterministic local IDs, schedule/
  cancel/reschedule reconciliation, restart bootstrap, denied-permission behavior, and notification
  tap routing.
- Payload snapshot tests proving no task title, notes, IDs, or tokens leave the approved boundary.
- Redis/PostgreSQL e2e with provider fetch mocked: queue, worker, retry, dedupe, cancellation,
  delivery log, and invalid-token cleanup.
- Manual device/emulator smoke on at least one Android or iOS target. If unavailable, report the
  exact commands and mark it **not verified**, never passed.
- Run API build, full API tests, mobile typecheck, full mobile tests, and scoped diff checks.

## Documentation Updates

- `docs/API.md`: token register/remove contract, auth/status/errors, and any bounded reminder query.
- `docs/Backend.md`: device-token ownership, queue/worker/provider flow, retry and failure behavior.
- `docs/Architecture.md`: local scheduler and remote scheduler boundaries plus device-token model.
- `docs/Engineering-Handbook-v5.md` sections 5/6/8/9/12/14/15/17 with factual implemented notes.
- `docs/ADR/ADR-006-bullmq-redis-expo-push-notifications.md` and new ADR-009 if needed.
- `docs/ai/IMPLEMENTATION_STATE_v2.md` and `docs/ai/NEXT_STEPS_v2.md` with actual verified counts;
  keep e2e/device evidence explicitly verified or not verified.
- Do not modify Constitution, Vision, User Bible, or Product Bible policy.
