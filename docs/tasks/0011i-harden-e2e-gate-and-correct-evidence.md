# Task 0011I: Harden Notification E2E Gate and Correct Evidence

**Status:** ready for autonomous implementation  
**Source:** Product Review of Task 0011H

## Goal

Make the notification e2e gate fail cleanly when Redis/PostgreSQL are unavailable and correct the
Task 0011H evidence wording so it distinguishes attempted gates from a real device smoke run.

## Authorization

Modify e2e test-harness code and permitted status documentation autonomously inside the repository
without asking for confirmation. Production behavior, Product Bible policy, deployments, and git
history must remain unchanged.

## Findings To Correct

- `apps/api/test/notification-reliability.e2e-spec.ts` assumes `prisma`, `queue`, and `app` were
  initialized in `afterAll`. When `app.init()` fails because infrastructure is unavailable,
  teardown dereferences `prisma` and throws a secondary `TypeError`.
- BullMQ connections remain open after the failed bootstrap, so Jest can hang instead of returning a
  bounded, interpretable failure.
- Task 0011H status docs say “all three gates executed” even though the device smoke matrix was not
  run; only prerequisites were checked.

## Functional Requirements

- Add a repository-local preflight or equivalent guarded setup so missing Redis/PostgreSQL produces a
  clear failed/skipped e2e result without starting an unclosable worker.
- Make teardown null-safe and close every resource that was actually initialized, including partial
  Nest application startup and BullMQ queue/worker handles.
- Preserve a non-zero result for an attempted e2e gate when required services are unavailable; do
  not turn infrastructure failure into a passing test.
- Update `docs/ai/IMPLEMENTATION_STATE_v2.md`, `docs/ai/NEXT_STEPS_v2.md`, and ADR-009 to say that
  e2e and migration gates were attempted and failed, while device smoke was **NOT VERIFIED** because
  no device/emulator was available.
- Record the observed timeout/open-handle behavior and the exact rerun commands.

## Acceptance Criteria

- With Redis/PostgreSQL stopped, `npm.cmd run test:e2e --workspace=apps/api` exits within a bounded
  timeout, returns non-zero, and does not emit a secondary `Cannot read properties of undefined`
  teardown error or hang on BullMQ handles.
- With live services, the existing three notification e2e tests remain runnable without weakening
  assertions.
- No production source files are changed.
- Status docs no longer claim that the device gate was executed; they explicitly label it
  **NOT VERIFIED** and retain **NOT launch-ready** wording.
- Status docs distinguish `FAILED` (attempted e2e/migration) from `NOT VERIFIED` (device smoke).
- `git diff --check` passes for edited test/documentation files, excluding pre-existing CRLF warnings.

## Out of Scope

- Changing notification delivery, scheduling, channel policy, migrations, or product behavior.
- Provisioning Docker, Redis, PostgreSQL, Android, or iOS infrastructure.
- Replacing real-device evidence with Jest mocks.

## Verification

```powershell
npm.cmd run test:e2e --workspace=apps/api
git diff --check -- apps/api/test/notification-reliability.e2e-spec.ts docs/ADR docs/ai
```

Report both unavailable-infrastructure behavior and live-infrastructure results separately. Never
claim launch readiness unless live e2e, migration, and real-device smoke evidence all pass.
