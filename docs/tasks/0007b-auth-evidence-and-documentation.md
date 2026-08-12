# Task 0007B: Recovery Auth Evidence and Documentation Alignment

**Status:** ready for autonomous implementation  
**Depends on:** Task 0007A Product Review  
**Scope:** corrective evidence and documentation only; do not add product capabilities

## Goal

Close the remaining Task 0007A acceptance blockers by making the authenticated integration
evidence prove JWT identity correctly and aligning all affected engineering documentation with
the current implementation and verified test results.

## Authorization

The implementer may autonomously create or modify any files inside this repository that are
needed for this task, including tests and engineering documentation. Do not ask the user for
permission or confirmation for routine in-project changes. Preserve unrelated user changes.
Do not publish, deploy, push, modify external systems, or change any Product Bible policy.

## Confirmed findings

1. `tasks.controller.recovery.auth-integration.spec.ts` returns the same `TEST_USER` for every
   JWT subject, so it does not prove that the authenticated identity is derived from `payload.sub`.
2. The current identity assertion checks an absent `userId` filter rather than asserting the
   actual user identity reaching the controller/service boundary.
3. Recovery documentation contains stale test counts (`132/156`) after the verified totals became
   `153 API / 168 mobile`.
4. API and ADR text still describes destination validity relative to local-day start instead of
   the implemented strict `targetStartTime > referenceInstant` rule.
5. Engineering Handbook sections 6, 8, and 9 do not fully record the strict absolute timestamp,
   Today-only guard, authenticated integration evidence, and privacy-safe Recovery logging.

## Functional requirements

### Authenticated identity evidence

- Keep the real `JwtAuthGuard`, real `JwtStrategy`, real `TasksController`, and real
  `TaskRecoveryService` in the integration suite.
- Configure the Prisma user mock by requested ID: the test user ID returns the test user, a
  second user ID returns a distinct second user, and unknown IDs return `null`.
- Add a test that signs a valid token for the second user and proves the request is evaluated as
  that user, not as the first test user.
- Prove ownership using two users: a task owned by user A must be rejected when the token belongs
  to user B, while a task owned by user B can be processed by user B.
- Assert the concrete identity input at an observable boundary (for example the user lookup
  called by `JwtStrategy` and the `userId` included in the real service's conditional write).
- Preserve coverage for unauthenticated rejection, invalid signature rejection, mixed ownership
  atomic rejection, valid success, and partial reminder success.
- Do not replace the real guard or strategy with a mock in this suite.

### Documentation alignment

- Update `docs/Backend.md` to the currently verified API test result: **153 passed / 10 suites**.
- Remove or clearly label superseded historical `132/156` blocks in
  `docs/ai/IMPLEMENTATION_STATE_v2.md` and `docs/ai/NEXT_STEPS_v2.md`; there must be one
  unambiguous current result.
- Update ADR-008 factual contract and status history to state that dated destinations must be
  absolute ISO instants with explicit `Z` or numeric offset and strictly later than the service
  `referenceInstant`. Keep explicit `null` as Inbox.
- Update `docs/API.md` status/error text to match the strict future rule and absolute timestamp
  validation.
- Update `docs/Engineering-Handbook-v5.md` sections 6, 8, and 9 to document:
  - the canonical profile-timezone date key used by Today, Recovery, and invalidation;
  - the Today-only Recovery guard and behavior for invalid/missing profile timezone;
  - the absolute ISO timestamp contract and strict future validation;
  - the real authenticated integration suite and its covered boundaries;
  - outcome/count/failure-class observability without task/user identifiers in new Recovery logs;
  - PostgreSQL/Redis e2e and device smoke as explicitly not verified in this environment.
- Do not modify Product Constitution, Product Vision, User Bible, or any Product Bible policy.

## Non-functional requirements

- No production behavior changes are authorized unless required to make the test evidence
  accurate; prefer test and documentation changes only.
- Preserve TypeScript strictness and existing Jest lifecycle cleanup.
- Do not use `--forceExit`, artificial timeouts, skipped tests, or weakened assertions.
- Keep historical test results only when clearly labeled as historical; current status must not be
  ambiguous.
- Keep logs free of task titles, tokens, user IDs, and task IDs for new Recovery log lines.

## Acceptance criteria

- The auth integration suite passes with at least one token for each of two distinct users and
  proves JWT subject to user identity mapping.
- A foreign task is rejected for the second user before any transaction or `updateMany` call.
- A valid task owned by the authenticated user succeeds through the real guard/controller/service
  path.
- The focused auth suite passes with `--runInBand --detectOpenHandles` and has no open-handle
  warnings.
- API build, full API tests, mobile typecheck, full mobile tests, focused Recovery tests, and
  scoped diff checks pass.
- No current documentation states `132/156` as the latest result.
- API/ADR/Handbook text consistently states explicit-offset ISO and strict future destination
  semantics.
- Engineering Handbook sections 6, 8, and 9 contain the required recovery evidence and privacy
  rules.
- Product Bible files and policy remain unchanged.
- PostgreSQL/Redis e2e and device smoke remain explicitly labeled **not verified**; no completion
  claim implies they passed.

## Out of scope

- New Recovery features, new UI behavior, recurrence, notifications redesign, OAuth hardening,
  billing, offline sync, deployment, or infrastructure setup.
- Starting Docker, PostgreSQL, Redis, an emulator, or an external service.
- Product copy or Product Bible policy changes.

## Verification commands

```powershell
npm.cmd run test --workspace=apps/api -- tasks.controller.recovery.auth-integration.spec.ts --runInBand --detectOpenHandles
npm.cmd run build:api
npm.cmd run test --workspace=apps/api -- --runInBand
npx.cmd tsc --noEmit -p apps/mobile/tsconfig.json
npm.cmd run test --workspace=apps/mobile -- --runInBand
npm.cmd run test --workspace=apps/mobile -- RecoverySection.spec.tsx --runInBand --detectOpenHandles
git diff --check -- apps/api apps/mobile packages/shared-types/src/index.ts docs/API.md docs/Backend.md docs/Architecture.md docs/Engineering-Handbook-v5.md docs/ADR/ADR-008-overdue-task-recovery.md docs/ai/IMPLEMENTATION_STATE_v2.md docs/ai/NEXT_STEPS_v2.md package-lock.json
```

Report exact results, changed files, unavailable infrastructure, and residual risks, then stop.
