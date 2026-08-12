# Task 0007A: Final Recovery Acceptance Remediation

**Status:** ready for autonomous implementation  
**Depends on:** Task 0007 review  
**Scope:** corrective work only; do not add product capabilities

## Goal

Correct the remaining Guilt-Free Recovery defects found during the independent Task 0007
Product Review, then produce evidence strong enough to re-run final acceptance.

## Authorization

The implementer may autonomously create or modify any files inside this repository that are
needed for this task, including production source, tests, configuration, shared contracts, and
engineering documentation. Do not ask the user for confirmation for routine in-project changes.
Preserve unrelated work. Do not publish, deploy, push, modify external systems, or change
Product Bible policy.

## Confirmed findings

1. The Today task query uses a UTC `toISOString().slice(0, 10)` key while Recovery uses a
   profile-timezone key. Around midnight, especially with device/profile timezone mismatch,
   Today can request or invalidate a different calendar key than Recovery.
2. `RescheduleRecoveryDto` accepts ISO values without an explicit offset, and the service only
   rejects destinations before local-day start. A destination earlier than the current instant
   on the current local day can therefore be committed, despite the Task 0002 past-destination
   contract.
3. The Recovery HTTP spec overrides `JwtAuthGuard` and mocks `TaskRecoveryService`. It proves
   routing and the real `ValidationPipe`, but not a real authenticated controller-to-service
   path. The configured API e2e suite cannot run in the current environment because PostgreSQL
   and Redis are unavailable; this limitation must remain explicit.
4. `RecoverySection` renders the timezone-unavailable state before checking whether the selected
   date is Today, so an invalid profile timezone leaks a Recovery-only state onto historical
   dates.
5. Recovery logs include stable user/task identifiers. Observability must retain outcome,
   counts, and failure class without logging titles, tokens, or unnecessary identifiers.

## Functional requirements

### Canonical date and cache contract

- Define one canonical profile-timezone date-key helper for Today, Recovery, and all mutation
  invalidation paths that represent the same server day.
- Update the production Today query/hook and the Recovery mutation invalidation to use the same
  key for the same `selectedDate` and profile timezone.
- Preserve existing behavior for callers that do not yet have a valid profile timezone; do not
  silently use UTC for Recovery. Keep non-Recovery historical navigation usable.
- Add a regression test at a fixed instant where UTC date and profile date differ (at least one
  negative and one positive offset) proving that Today and Recovery request/invalidate the same
  key and the same server day.

### Destination contract

- Accept only an absolute, unambiguous ISO-8601 instant with an explicit `Z` or numeric offset;
  reject date-only and offsetless datetime values at the DTO/HTTP boundary.
- Reject any non-null destination that is earlier than the current `referenceInstant` used by
  the service. Keep the Inbox meaning of explicit JSON `null` unchanged.
- Keep server-side validation authoritative and ensure all rejected batches perform no
  transaction or write. Add tests for offsetless, date-only, malformed, equal-to-now, and
  earlier-today destinations.
- Keep the existing local-day/DST semantics for overdue eligibility and test both DST and
  timezone mismatch behavior.

### Today-only timezone state

- Recovery must render nothing on non-Today dates, including when the profile timezone is
  missing or invalid.
- On Today with missing/invalid timezone, render the neutral recoverable state and do not issue
  Recovery reads or writes. Preserve the profile-settings action when supplied.
- Add a component regression test covering invalid timezone on a historical selected date.

### Authenticated integration evidence

- Preserve the existing real HTTP-boundary suite for DTO and status mapping.
- Add at least one Nest HTTP integration test that exercises the real `TasksController`, the
  real `TaskRecoveryService`, and the real `JwtAuthGuard` identity path using test-owned
  dependencies or a deterministic test database strategy available in the repository.
- Prove that unauthenticated requests are rejected, authenticated identity is taken from JWT
  context, ownership is enforced, and a mixed valid/invalid batch has no partial write.
- If PostgreSQL/Redis-backed e2e cannot run in the environment, report the exact command,
  failure, and missing services. Do not mark that unavailable check as passed and do not use
  `--forceExit` or artificial timeouts.

### Observability

- Keep outcome, updated count, reminder-sync status, and failure class observable.
- Remove unnecessary user/task identifiers from new Recovery log lines, or apply the existing
  repository-approved redaction/allowlist convention.
- Add or update a focused test/inspection that protects the logging contract without asserting
  on PII.

## Non-functional requirements

- No Product Bible files or product policy may change.
- Keep PostgreSQL/Prisma as source of truth and preserve conditional `updateMany` eligibility
  inside the transaction.
- Preserve explicit destination mapping, atomic rollback, stale-state `409`, partial reminder
  `200`, React Query state separation, and neutral adult copy.
- Avoid broad refactors. Keep the change limited to the canonical date contract, validation,
  Today-only guard, integration evidence, logging, tests, and affected engineering docs.
- Maintain TypeScript strictness, existing accessibility touch targets, and Jest lifecycle
  cleanup from Task 0006D.

## Acceptance criteria

- A fixed device/profile timezone mismatch produces one identical canonical date key for Today,
  Recovery, and successful mutation invalidation.
- Today never displays tomorrow's or yesterday's tasks because of UTC/device/profile mismatch.
- Offsetless, date-only, malformed, equal-to-now, and earlier-today destinations are rejected
  with documented status and no writes; explicit `null` remains a valid Inbox destination.
- Historical Today navigation never renders the Recovery timezone error state.
- Real HTTP integration evidence covers unauthenticated rejection, JWT identity, ownership,
  stale state, mixed-batch atomicity, and reminder partial-success behavior where the test
  environment permits it.
- Recovery logs contain no new task titles, tokens, or unnecessary stable identifiers.
- Mobile typecheck, full mobile tests, focused Recovery tests with `--detectOpenHandles`, API
  build, API unit/integration tests, and scoped diff checks pass with exact counts reported.
- Any unavailable PostgreSQL/Redis e2e or device smoke check is reported as **not verified**;
  no completion claim implies it passed.
- Product Constitution, Product Vision, User Bible, and Product Bible policy remain unchanged.

## Out of scope

- Recurrence occurrence generation, Smart Planner, offline sync, notification launch readiness,
  billing, themes, or unrelated auth hardening.
- New product copy or policy decisions.
- Production deployment, publishing, pushing, or external infrastructure changes.

## Required documentation updates

- Update `docs/API.md`, `docs/Backend.md`, `docs/Architecture.md`, and Engineering Handbook
  sections 6, 8, and 9 to describe the canonical date key, strict absolute timestamp contract,
  Today-only guard, authenticated integration evidence, and privacy-safe observability.
- Update ADR-008 factual notes and status only to match verified evidence.
- Correct `docs/ai/IMPLEMENTATION_STATE_v2.md` and `docs/ai/NEXT_STEPS_v2.md`; do not claim final
  acceptance while any required fix or unavailable verification remains unresolved.

## Verification commands

```powershell
npx.cmd tsc --noEmit -p apps/mobile/tsconfig.json
npm.cmd run test --workspace=apps/mobile -- --runInBand
npm.cmd run test --workspace=apps/mobile -- RecoverySection.spec.tsx --runInBand --detectOpenHandles
npm.cmd run build:api
npm.cmd run test:api -- --runInBand
npm.cmd run test:e2e --workspace=apps/api -- --runInBand
git diff --check -- apps/api apps/mobile packages/shared-types/src/index.ts docs/API.md docs/Backend.md docs/Architecture.md docs/Engineering-Handbook-v5.md docs/ADR/ADR-008-overdue-task-recovery.md docs/ai/IMPLEMENTATION_STATE_v2.md docs/ai/NEXT_STEPS_v2.md package-lock.json
```

Stop after this task and report changed files, exact command results, acceptance evidence,
unavailable infrastructure, manual smoke status, and residual risks.
