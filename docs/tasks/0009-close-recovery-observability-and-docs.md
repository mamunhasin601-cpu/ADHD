# Task 0009: Close Recovery Observability and Documentation

**Status:** ready for autonomous implementation  
**Source:** Product Review after Task 0007C  
**Scope:** Recovery observability, tests, and documentation correction only

## Goal

Close the remaining Guilt-Free Recovery review findings by making the implemented Recovery
logging contract match Implementation Package 0001 and by removing superseded verification
evidence from the current engineering status document.

This task does not add a product feature.

## Authorization

The implementer is authorized to autonomously create and modify any files inside this repository
that are necessary to complete this task. Do not ask the user for permission or confirmation for
routine in-project file creation, edits, test changes, or documentation updates. Preserve unrelated
work. Do not publish, deploy, push, modify external systems, or change Product Bible policy.

## Confirmed Findings

1. `TaskRecoveryService.getOverdueTasks()` currently logs `localDayStart` and `timezone`.
2. Implementation Package 0001 requires Recovery observability to record outcome, counts, latency,
   and failure class without titles, tokens, or other PII.
3. Task 0007C and ADR-008 claim that Recovery logs contain only outcome/counts/failure-class, which
   does not match the implementation.
4. Engineering Handbook section 6 excludes timezone from the allowed fields, while section 9
   includes it. The Handbook is internally inconsistent.
5. Recovery log lines do not currently record latency.
6. `docs/ai/NEXT_STEPS_v2.md` still contains a complete post-0007A `153/168` verification table in
   addition to the current post-0007C `160/168` table. Task 0007C explicitly required the duplicate
   superseded result block to be removed.

## Requirements

### 1. Implement one Recovery observability contract

- Update Recovery logging so its structured fields are limited to:
  - `outcome`;
  - operation-relevant counts;
  - `latencyMs`;
  - `reminderSyncStatus` where applicable;
  - `failureClass` where applicable.
- Remove `timezone` and `localDayStart` from Recovery log output.
- Never log `userId`, `taskId`, task title, tokens, request payloads, destination timestamps, or
  other user-owned content from Recovery paths.
- Preserve existing HTTP behavior, transaction semantics, task selection, timezone calculations,
  response DTOs, reminder behavior, and error mapping.
- Use the repository's existing NestJS logger and test patterns. Do not add a new telemetry
  dependency or broad logging abstraction for this task.
- Latency assertions must be deterministic. Tests may assert the presence and numeric shape of
  `latencyMs`; they must not depend on exact wall-clock duration.

### 2. Add regression coverage

- Add or extend focused `TaskRecoveryService` tests that spy on Recovery logger calls.
- Prove successful query logging includes outcome, count, and `latencyMs`.
- Prove successful reschedule and partial reminder paths use only the allowed field categories.
- Prove Recovery logs contain none of the following values or field names:
  - test user IDs;
  - test task IDs;
  - test task titles;
  - `timezone`;
  - `localDayStart`.
- Keep the existing auth integration lifecycle and all 15 scenarios unchanged and passing.
- Do not weaken assertions, skip tests, use `--forceExit`, or add artificial delays/timeouts.

### 3. Correct engineering documentation

- Make `docs/Engineering-Handbook-v5.md` sections 6 and 9 state the same allowed Recovery log
  fields: outcome, counts, latency, reminder status, and failure class.
- Update `docs/ADR/ADR-008-overdue-task-recovery.md` so its current implementation evidence matches
  the actual verified logging contract. Do not rewrite historical ADR decisions.
- Update `docs/Backend.md` or other current Recovery documentation only if it contains a conflicting
  observability statement.
- Do not change Product Constitution, Product Vision, User Bible, or any Product Bible policy.

### 4. Remove superseded verification duplication

- Delete the complete post-0007A `153 passed / 10 suites` and `168 passed / 6 suites` verification
  table from `docs/ai/NEXT_STEPS_v2.md`, including its duplicate unavailable-check paragraph when it
  belongs to that superseded block.
- Keep one unambiguous current post-0007C-or-later verification block with the actual counts produced
  by this task.
- Do not present historical test counts as current evidence.
- Preserve useful historical implementation narrative that does not duplicate the current
  verification table.

## Acceptance Criteria

- No Recovery production log contains `timezone`, `localDayStart`, `userId`, `taskId`, task titles,
  tokens, destination timestamps, or request payloads.
- Recovery success and failure paths record outcome/counts/latency and, where relevant, reminder
  status or failure class.
- Focused logger regression tests pass and prove both allowed-field presence and forbidden-field
  absence.
- Focused auth integration suite remains **15/15 passed** with `--detectOpenHandles` and no lifecycle
  warning.
- Full API suite and API build pass.
- Mobile typecheck and full mobile suite remain green because the shared Recovery contract must not
  regress.
- `docs/Engineering-Handbook-v5.md` sections 6 and 9 and ADR-008 describe one factual observability
  contract.
- `docs/ai/NEXT_STEPS_v2.md` contains only one current full verification table; the superseded
  post-0007A table is removed.
- Core Product Bible policy files remain unchanged.
- PostgreSQL/Redis e2e and device smoke remain explicitly **not verified** unless they are actually
  executed in a suitable environment. Do not claim them as passed.
- Scoped `git diff --check` passes. CRLF conversion warnings may be reported but are not failures.

## Out of Scope

- New Recovery UX or product behavior.
- OAuth work.
- Database, Redis, queue, notification provider, or infrastructure setup.
- API e2e requiring unavailable services.
- Device/emulator smoke testing when no device or emulator is available.
- Refactoring unrelated logging or NotificationService messages.
- Deployment, publishing, pushing, commits, or Product Bible policy changes.

## Verification Commands

Run these commands and report the exact results and actual counts:

```powershell
npm.cmd run test --workspace=apps/api -- task-recovery.service.spec.ts --runInBand --detectOpenHandles
npm.cmd run test --workspace=apps/api -- tasks.controller.recovery.auth-integration.spec.ts --runInBand --detectOpenHandles
npm.cmd run build:api
npm.cmd run test --workspace=apps/api -- --runInBand
npx.cmd tsc --noEmit -p apps/mobile/tsconfig.json
npm.cmd run test --workspace=apps/mobile -- --runInBand
rg -n "Recovery query|Recovery reschedule|Recovery reminder|Reminder sync failed" apps/api/src/tasks/task-recovery.service.ts
rg -n "post-0007A|153 passed" docs/ai/NEXT_STEPS_v2.md
git diff --check -- apps/api/src/tasks/task-recovery.service.ts apps/api/src/tasks/task-recovery.service.spec.ts docs/Engineering-Handbook-v5.md docs/ADR/ADR-008-overdue-task-recovery.md docs/Backend.md docs/ai/NEXT_STEPS_v2.md
```

The `rg` search for `post-0007A|153 passed` must return no matches. Inspect the Recovery log calls
and their tests; a text search alone is not sufficient proof of the privacy contract.

## Completion Report

Report:

- every changed file;
- the final allowed Recovery log fields;
- the exact focused and full test/build results;
- the current API and mobile counts;
- unavailable checks;
- residual risks.

Do not stop after analysis or a plan. Make the required repository changes, run all available
verification commands, and stop only after the implementation and report are complete.
