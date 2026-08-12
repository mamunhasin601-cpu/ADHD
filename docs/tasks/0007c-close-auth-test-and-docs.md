# Task 0007C: Close Recovery Auth Test and Documentation

**Status:** ready for autonomous implementation  
**Depends on:** Task 0007B Product Review  
**Scope:** test reliability and documentation correction only

## Goal

Make the two-user Recovery auth integration suite deterministic and complete the documentation
alignment that Task 0007B did not finish.

## Authorization

The implementer may autonomously create or modify any files inside this repository that are
needed for this task. Do not ask the user for permission or confirmation for routine in-project
changes. Preserve unrelated work. Do not publish, deploy, push, modify external systems, or
change Product Bible policy.

## Confirmed findings

1. `tasks.controller.recovery.auth-integration.spec.ts` now proves identity with two users, but
   its focused suite fails: 14 passed, 1 failed.
2. `jest.clearAllMocks()` clears call history but does not clear queued
   `mockResolvedValueOnce`/`mockRejectedValueOnce` implementations.
3. The rejected `userId` body test configures service mocks that are never consumed because the
   production `ValidationPipe` rejects the request first. Those queued values leak into later
   tests, causing the partial-reminder test to return `reminderSyncStatus: "ok"` instead of
   `"partial"`.
4. The full API result is currently 159 passed / 1 failed / 160 total. Once fixed, the expected
   current result is 160 passed / 10 suites.
5. Required documentation still contains stale `132/156` results and old destination semantics.

## Requirements

### Test isolation

- Fix test lifecycle isolation in
  `apps/api/src/tasks/tasks.controller.recovery.auth-integration.spec.ts`.
- Reset queued mock implementations between tests, not only call history, and then restore the
  deterministic default implementations required by each test.
- Remove unnecessary service mock setup from requests that are rejected by the HTTP validation
  boundary before the service can run.
- Keep the real `JwtAuthGuard`, `JwtStrategy`, `TasksController`, and `TaskRecoveryService`.
- Preserve all 15 current auth integration scenarios, including:
  - unauthenticated and invalid-token rejection;
  - unknown JWT subject rejection;
  - two distinct JWT subjects resolving to two distinct users;
  - ownership rejection in both directions;
  - successful conditional writes gated by the authenticated user ID;
  - request-body `userId` rejection;
  - mixed-ownership atomic rejection;
  - valid dated reschedule;
  - queue failure returning HTTP 200 with `reminderSyncStatus: "partial"`.
- Do not weaken assertions, skip tests, use `--forceExit`, or add artificial timeouts.

### Documentation correction

- Replace stale current-result claims with the exact results produced after the fix. The expected
  result is **160 passed / 10 API suites** and **168 passed / 6 mobile suites**, but use the actual
  verified counts if they differ.
- Remove the duplicate superseded result block from `docs/ai/NEXT_STEPS_v2.md`; do not leave
  `132/156` presented as a current result.
- Update `docs/Backend.md`, `docs/ai/IMPLEMENTATION_STATE_v2.md`, and
  `docs/ai/NEXT_STEPS_v2.md` with one unambiguous current verification result.
- Update `docs/API.md` and `docs/ADR/ADR-008-overdue-task-recovery.md` so dated destinations:
  - are absolute ISO-8601 instants with explicit `Z` or numeric offset;
  - reject date-only and offsetless datetime values at the DTO boundary;
  - must be strictly later than the service `referenceInstant`;
  - reject equal-to-now and earlier-today values;
  - retain explicit `null` as the Inbox destination.
- Correct the ADR-008 status history with the current evidence. Do not imply PostgreSQL/Redis e2e
  or device smoke passed.
- Complete Engineering Handbook sections 6, 8, and 9 with concise factual notes covering:
  - canonical profile-timezone date keys for Today, Recovery, and invalidation;
  - Today-only Recovery rendering and invalid/missing timezone behavior;
  - strict absolute timestamp and strict future validation;
  - the real two-user authenticated integration path;
  - Recovery logging limited to outcome, counts, reminder status, and failure class without
    task/user identifiers;
  - unavailable PostgreSQL/Redis e2e and device smoke marked **not verified**.
- Do not change Product Constitution, Product Vision, User Bible, or Product Bible policy.

## Acceptance criteria

- Focused auth integration suite: **15/15 passed** with `--detectOpenHandles` and no lifecycle
  warning.
- Full API suite: expected **160/160 passed / 10 suites** with `--runInBand`.
- API build, mobile typecheck, mobile full suite, focused RecoverySection suite, and scoped diff
  checks pass.
- The partial-reminder auth integration test deterministically returns `partial` when run alone,
  after the preceding tests, and inside the full API suite.
- No affected document presents `132/156` as current evidence.
- API, ADR-008, Backend, Handbook, implementation state, and next steps agree with the actual
  implementation and verified test counts.
- Product Bible policy remains unchanged.
- API e2e and device smoke remain explicitly **not verified**.

## Out of scope

- Production Recovery behavior changes, new features, OAuth work, infrastructure setup,
  deployment, publishing, or Product Bible changes.

## Verification commands

```powershell
npm.cmd run test --workspace=apps/api -- tasks.controller.recovery.auth-integration.spec.ts --runInBand --detectOpenHandles
npm.cmd run build:api
npm.cmd run test --workspace=apps/api -- --runInBand
npx.cmd tsc --noEmit -p apps/mobile/tsconfig.json
npm.cmd run test --workspace=apps/mobile -- --runInBand
npm.cmd run test --workspace=apps/mobile -- RecoverySection.spec.tsx --runInBand --detectOpenHandles
rg -n "132 passed|156 passed|destination before local day start|destination раньше начала локального дня|future-or-today" docs/API.md docs/Backend.md docs/Engineering-Handbook-v5.md docs/ADR/ADR-008-overdue-task-recovery.md docs/ai/IMPLEMENTATION_STATE_v2.md docs/ai/NEXT_STEPS_v2.md
git diff --check -- apps/api apps/mobile packages/shared-types/src/index.ts docs/API.md docs/Backend.md docs/Architecture.md docs/Engineering-Handbook-v5.md docs/ADR/ADR-008-overdue-task-recovery.md docs/ai/IMPLEMENTATION_STATE_v2.md docs/ai/NEXT_STEPS_v2.md package-lock.json
```

The `rg` command must return no stale current-contract matches. Historical results may remain only
when explicitly labeled historical and must not conflict with the current status.

Report changed files, exact command results, actual test counts, unavailable checks, and residual
risks, then stop.
