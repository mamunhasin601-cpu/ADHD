# Task 0010: Complete Recovery Partial-Reminder Observability

**Status:** ready for autonomous implementation  
**Source:** Product Review of Task 0009  
**Scope:** one Recovery log path and its regression evidence

## Goal

Complete the Recovery observability contract for the partial reminder-sync path. The successful
query and commit logs now include latency and exclude infrastructure/user fields, but the partial
warning still omits the explicit `reminderSyncStatus=partial` and `latencyMs` fields required by
Task 0009 and Implementation Package 0001.

This task does not add product functionality or change Recovery behavior.

## Authorization

The implementer may autonomously create or modify any files inside this repository needed for this
task. Do not ask the user for permission or confirmation for routine in-project edits, tests, or
documentation updates. Preserve unrelated work. Do not publish, deploy, push, modify external
systems, or change Product Bible policy.

## Requirements

### Production logging

- Update the partial reminder-sync Recovery log so it explicitly contains:
  - `reminderSyncStatus=partial`;
  - operation counts (`committedCount`, `failedReminderCount` or equivalent);
  - numeric `latencyMs`.
- Keep the line free of `userId`, `taskId`, task titles, timezone, `localDayStart`, destination
  timestamps, tokens, request payloads, and other user-owned content.
- Preserve the existing 200 response, committed task updates, retry/reminder behavior, and error
  mapping. Do not alter transaction semantics.
- Use existing logger conventions; do not add telemetry dependencies or artificial delays.

### Tests

- Extend the focused `TaskRecoveryService` observability tests for the queue-failure path.
- Assert that the partial warning contains the explicit status, both relevant counts, and a numeric
  latency field.
- Assert forbidden identifiers and infrastructure fields are absent.
- Keep the existing 15 authenticated integration scenarios and all current tests unchanged in
  meaning; do not weaken, skip, or force-exit tests.

### Documentation

- Confirm that the Handbook sections 6 and 9, ADR-008 current evidence, and any current Backend
  observability note describe the same partial log contract.
- Do not duplicate verification tables or reintroduce superseded post-0007A evidence.
- Do not change Product Constitution, Product Vision, User Bible, or Product Bible policy.

## Acceptance Criteria

- Partial Recovery warning contains `reminderSyncStatus=partial`, counts, and numeric `latencyMs`.
- Partial Recovery warning contains no user/task identifiers, titles, timezone, localDayStart,
  destination timestamps, tokens, or request payloads.
- Focused `TaskRecoveryService` suite passes with the new assertions.
- Auth integration remains 15/15; full API suite remains green; API build passes.
- Mobile typecheck and full mobile suite remain green.
- Current documentation matches the implementation and contains no superseded post-0007A result
  table.
- PostgreSQL/Redis e2e and device smoke remain explicitly **not verified** unless actually run.
- Scoped `git diff --check` passes.

## Out of Scope

- New Recovery UX or API behavior.
- Changes to query/commit log formats beyond what is necessary for this partial path.
- OAuth, infrastructure, e2e setup, device testing, deployment, or Product Bible changes.

## Verification Commands

```powershell
npm.cmd run test --workspace=apps/api -- task-recovery.service.spec.ts --runInBand --detectOpenHandles
npm.cmd run test --workspace=apps/api -- tasks.controller.recovery.auth-integration.spec.ts --runInBand --detectOpenHandles
npm.cmd run build:api
npm.cmd run test --workspace=apps/api -- --runInBand
npx.cmd tsc --noEmit -p apps/mobile/tsconfig.json
npm.cmd run test --workspace=apps/mobile -- --runInBand
git diff --check -- apps/api/src/tasks/task-recovery.service.ts apps/api/src/tasks/task-recovery.service.spec.ts docs/Engineering-Handbook-v5.md docs/ADR/ADR-008-overdue-task-recovery.md docs/Backend.md docs/ai/NEXT_STEPS_v2.md
```

Report changed files, exact results/counts, unavailable checks, and residual risks, then stop.
