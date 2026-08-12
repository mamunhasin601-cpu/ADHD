# Task 0011A: Complete Notification Integration and Evidence

**Status:** ready for autonomous implementation  
**Source:** Product Review of Implementation Package 0011  
**Scope:** close confirmed notification integration, security, deduplication, and test-evidence gaps

## Goal

Make the Package 0011 implementation satisfy its actual acceptance contract. The current code adds
useful DeviceToken and generic-payload foundations, but it does not yet provide a complete local and
remote reminder flow and must not be presented as an implemented Notification Reliability MVP.

This task fixes missing integration and evidence. It does not add a new product feature.

## Authorization

The implementer is authorized to autonomously create and modify any files inside this repository
required by this task, including source, tests, migrations, ADRs, and engineering documentation.
Do not ask the user for permission or confirmation for routine in-project work. Preserve unrelated
changes. Do not publish, deploy, push, commit, modify external systems, or change Product Bible
policy.

## Confirmed Findings

1. `apps/mobile/lib/local-notifications.ts` is called only from root bootstrap. Task create, edit,
   complete, delete, Inbox move, and Recovery reschedule do not reconcile local reminders.
2. There are no mobile tests for local notification IDs, scheduling, cancellation, reconciliation,
   permission states, task mutation integration, restart behavior, or notification-tap routing.
3. Root bootstrap calls unbounded `GET /tasks` and filters the seven-day horizon only on the client.
   This violates the bounded server-projection requirement.
4. `reconcileLocalReminders()` calls `cancelAllScheduledNotificationsAsync()`, which can remove
   unrelated application notifications instead of only Focus task-reminder IDs.
5. Permission denial is silently ignored and `requestPermissionsAsync()` is attempted again on
   later authenticated bootstraps. There is no neutral user-visible state or explicit settings
   action.
6. No notification-response listener routes a tap to Today or the existing task context.
7. Local and remote reminders are both scheduled for the same task/start instant. Deterministic IDs
   in Expo local storage and BullMQ are different namespaces and do not prevent two user-visible
   notifications. ADR-009 incorrectly claims that its current dedup strategy prevents this.
8. `registerDeviceToken()` silently reassigns a token owned by another user. This violates the
   required foreign-user isolation and permits token ownership takeover when a token value is known.
9. The token DTO accepts broad provider-like strings and arbitrary platform strings despite the
   documented Expo/platform contract. There are no DTO or real HTTP-boundary tests.
10. Multi-device fan-out returns `sent` when any device succeeds. Retryable failures on other devices
    are then lost, while retrying the whole fan-out would duplicate already-successful deliveries.
    `NotificationLog` and `wasRecentlyDelivered(taskId)` are task-global and cannot prove or enforce
    per-device delivery idempotency.
11. There is no authenticated NotificationsController integration suite proving two-user ownership,
    validation, conflict, register, restore, and removal behavior through the real guard/pipe path.
12. `apps/api/test/notification-reliability.e2e-spec.ts` still creates a legacy
    `User.expoPushToken` and enqueues `taskTitle`; it does not test the new DeviceToken/job contract
    and will be stale when infrastructure becomes available.
13. ADR-009 and current implementation-status documents claim an implemented MVP even though these
    boundaries and the required e2e/device evidence are absent.

## Requirements

### 1. Define and enforce one delivery-channel policy

- Choose and document one explicit per-installation policy that guarantees at most one user-visible
  reminder for a task/start instant.
- A recommended MVP policy is remote-primary with local fallback when remote registration/delivery
  is unavailable, but an alternative is acceptable only if tests prove cross-channel non-duplication
  in foreground, background, restart, and multi-device scenarios.
- Do not claim that matching local and BullMQ identifiers deduplicate across different runtimes.
- Update ADR-009 with the real ownership rule, state transitions, failure behavior, and trade-offs.

### 2. Complete mobile lifecycle integration

- Integrate the selected local scheduling policy with successful task create, update, toggle,
  delete, Inbox move, and Recovery reschedule flows.
- Future incomplete scheduled state schedules/reschedules; null, completed, deleted, past, or stale
  state cancels.
- Bootstrap reconciliation must use a bounded authenticated server query with explicit `from`/`to`
  or an equivalent documented horizon. Do not download every task and filter only on the client.
- Reconciliation may cancel only app-owned Focus task reminders discovered by deterministic prefix
  or persisted ownership metadata. Do not cancel unrelated scheduled notifications.
- Permission denial must not loop. Persist/derive a stable denied state, show neutral actionable UI,
  and request again only after an explicit user action or an OS state change.
- Add and clean up a notification-response listener. A generic reminder tap routes safely to Today;
  stale/missing task context must not crash.
- Treat token registration and scheduling as secondary effects; task CRUD remains usable during
  notification failures.

### 3. Enforce device-token security and validation

- Re-registering an active/revoked token for the same authenticated user is idempotent/restorative.
- Registering a token owned by another user must not silently transfer ownership. Return a stable
  conflict/forbidden response and perform no write. Any future transfer flow requires explicit proof
  and is out of scope.
- Restrict token and platform DTO values to the actual supported contract, enforce bounded length,
  and reject unknown fields through the production ValidationPipe.
- Never log tokens or return token values in responses.
- Keep removal ownership-aware and prove the foreign-user path performs no write.

### 4. Make multi-device retry and idempotency real

- Track delivery outcome at the device-token level, or use an equivalent persistent idempotency key
  containing task/start/device identity.
- Retry only retryable failed device deliveries. Do not resend to devices already recorded as
  delivered, and do not suppress undelivered devices because another device succeeded.
- `DeviceNotRegistered` revokes only that device and is not retried.
- No-token is terminal until registration changes; provider/network/5xx failures use bounded retry.
- Logs remain privacy-safe: outcome, counts, latency, reminder status, provider-safe code, and
  failure class only. No task/user/token identifiers or content.
- Preserve task-write/secondary-effect separation and existing Recovery partial semantics.

### 5. Replace missing and stale evidence

- Add focused mobile tests for local IDs, generic payload, schedule/cancel/reschedule, owned-only
  reconciliation, bounded horizon, denied/granted permission, mutation integration, bootstrap, tap
  routing, and cross-channel non-duplication policy.
- Add DTO tests and a real authenticated HTTP integration suite for NotificationsController with
  two users and two devices. Use real JwtAuthGuard/JwtStrategy/ValidationPipe and production
  controller/service boundaries with deterministic test-owned persistence mocks where needed.
- Add service/processor tests for partial fan-out: one success + one retryable failure, one success +
  one invalid token, retry without duplicate successful delivery, and per-device dedup.
- Rewrite `notification-reliability.e2e-spec.ts` for DeviceToken, compact job payload, per-device
  outcomes, retry, dedup, cancellation, and invalid-token revocation. Remove `taskTitle` and legacy
  token setup from current-contract e2e evidence.
- Preserve all Recovery, Inbox, auth, task, and existing mobile tests.

### 6. Correct documentation status

- Mark Package 0011 as incomplete until all runnable gates pass; never call device/e2e behavior
  acceptance-verified without evidence.
- Correct ADR-006, ADR-009, API, Backend, Architecture, Handbook, implementation state, and next
  steps to match the implemented delivery policy and actual evidence.
- Keep Redis/PostgreSQL e2e and device smoke explicitly **not verified** when infrastructure is
  unavailable. Passing unit tests is not substitute evidence.
- Do not change Constitution, Vision, User Bible, or Product Bible policy.

## Acceptance Criteria

- A task mutation immediately schedules/reschedules/cancels the correct local reminder according to
  the selected channel policy.
- Bootstrap uses a bounded server projection and reconciles only owned Focus reminder identifiers.
- Permission denial does not loop and produces a neutral actionable state; explicit retry works.
- Notification tap routes safely to Today and listener cleanup is verified.
- One task/start instant produces at most one user-visible reminder per installation across local
  and remote channels.
- A foreign-owned token cannot be registered, restored, reassigned, or removed by another user.
- DTO/HTTP tests prove strict validation, unknown-field rejection, two-user ownership, idempotent
  same-user registration/restoration, and removal.
- Partial fan-out retries failed devices without duplicating successful devices; invalid tokens are
  revoked individually.
- Current e2e uses DeviceToken and compact job payload and contains no `taskTitle`/legacy setup.
- API build, Prisma validation/generation, focused notification suites, full API suite, mobile
  typecheck, full mobile suite, and scoped diff checks pass.
- Redis/PostgreSQL e2e and real-device smoke are run when available and otherwise remain explicitly
  not verified; Package 0011 is not declared launch-ready without both.
- Product review confirms neutral copy, privacy-safe generic payload, user agency, and no duplicate
  pressure.

## Out of Scope

- New reminder timing, snooze, quiet hours, recurring occurrence reminders, campaigns, analytics
  dashboard, notification inbox, email/SMS, offline outbox, or marketing pushes.
- Product Bible changes, deployment, publishing, unrelated auth/OAuth hardening, themes, billing,
  or recurring-task implementation.

## Verification Commands

Run and report exact results/counts:

```powershell
npx.cmd prisma validate --schema apps/api/prisma/schema.prisma
npx.cmd prisma generate --schema apps/api/prisma/schema.prisma
npm.cmd run test --workspace=apps/api -- notifications --runInBand --detectOpenHandles
npm.cmd run build:api
npm.cmd run test --workspace=apps/api -- --runInBand
npx.cmd tsc --noEmit -p apps/mobile/tsconfig.json
npm.cmd run test --workspace=apps/mobile -- --runInBand
npm.cmd run test:e2e --workspace=apps/api -- --runInBand
git diff --check -- apps/api/prisma apps/api/src/notifications apps/api/src/tasks apps/api/test apps/mobile/app apps/mobile/lib docs/API.md docs/Backend.md docs/Architecture.md docs/Engineering-Handbook-v5.md docs/ADR/ADR-006-bullmq-redis-expo-push-notifications.md docs/ADR/ADR-009-device-token-and-reminder-channels.md docs/ai/IMPLEMENTATION_STATE_v2.md docs/ai/NEXT_STEPS_v2.md package-lock.json
```

For device smoke, report platform/build, permission path, task lifecycle steps, observed local/remote
delivery count, restart behavior, and cancellation evidence. If unavailable, state **not verified**.

## Completion Report

Report changed files, selected channel policy, security behavior, exact test/build/e2e results,
device smoke evidence, unavailable checks, and residual risks. Do not stop after analysis or a plan.
Implement the task completely, verify it, report, and stop.
