# Task 0007: Finalize Guilt-Free Recovery Acceptance

**Status:** ready after Task 0006  
**Depends on:** Tasks 0004, 0005, and 0006

## Execution directive

Execute this final acceptance task now. Do not ask for permission. You are authorized to create
and modify tests, source files needed to fix discovered regressions, configuration, ADRs, and
engineering documentation inside the repository.

This is not a review-only request. Start with verification, fix every in-scope failure you find,
then update documentation to match evidence. Do not stop after reporting a failed check. Preserve
unrelated work and do not modify Product Bible policy, publish, deploy, push, or change external
systems.

Read only packages 0001/0002 acceptance criteria, the changed implementation, current tests, and
the documentation files listed below. Do not reread the full superseded Task 0003 unless a
specific requirement is unclear.

## Goal

Prove the complete recovery vertical slice meets package 0001 and synchronize all engineering
documentation. Correct any remaining in-scope defect found by the checks.

## Acceptance verification

Verify with automated tests where possible:

1. An overdue incomplete root task appears on Today; no entry appears without overdue tasks.
2. Opening Today/recovery and canceling make no write.
3. One or multiple tasks can be selected with a visible mixed destination mapping.
4. Only explicit JSON `null` means Inbox; missing destination is rejected.
5. Foreign, completed, future, recurring, stale, invalid, empty, duplicate, and oversized input
   produces no partial write.
6. Midnight, IANA timezone, DST, and device/profile mismatch behavior is correct.
7. Reminder reschedule/cancel is idempotent; queue failure leaves the task commit and produces
   visible partial-success UX.
8. Today, Inbox, and recovery state agree without restart; failures remain retryable.
9. Existing CRUD, toggle, exact-day, ownership, OAuth, and notification behavior remains green.
10. Copy and behavior preserve agency, neutral rescheduling, and a visible next step.

Add any missing controller, integration/e2e, hook, or component test required to prove these
items. Correct remaining implementation defects rather than documenting them as complete.

## Required documentation updates

- `docs/API.md`: full Inbox/recovery query, request, response, auth, status, error, ownership,
  explicit-null, partial-reminder, and cache behavior.
- `docs/Backend.md`: validation, transaction, concurrency, Inbox read, and reminder side effect.
- `docs/Architecture.md`: backend/shared/mobile vertical slice and cache/data flow.
- `docs/Engineering-Handbook-v5.md` sections 6, 8, and 9: implemented recovery invariants and
  failure behavior.
- `docs/ADR/ADR-008-overdue-task-recovery.md`: implementation status and factual notes. Keep the
  actual Free-tier limit consistent with shared types and PlanService.
- `docs/ai/IMPLEMENTATION_STATE_v2.md` and `docs/ai/NEXT_STEPS_v2.md`: use actual status and actual
  test counts. Remove unsupported claims.

Do not mark the capability complete until mandatory checks pass. Do not change Product
Constitution, Product Vision, User Bible, or other Product Bible policy.

## Mandatory commands

Run and report exact results for:

1. API build/typecheck;
2. API unit tests;
3. API integration/e2e tests;
4. Mobile TypeScript;
5. Mobile tests;
6. configured lint commands, if present;
7. `git diff --check` for task files.

Run an authenticated emulator/device smoke flow when the environment supports it: create an
overdue task, open/cancel recovery, move tasks to future and Inbox, verify all views, exercise a
retry/partial reminder state, and confirm repeat submission has no duplicate effect. If the
environment cannot perform it, state that accurately and do not call it passed.

## Definition of done

- Every package 0001 acceptance criterion has evidence.
- Mandatory automated gates pass.
- Required backend and mobile test layers exist.
- Engineering Handbook, API, architecture, backend, ADR, and status documents match reality.
- Product Bible policy is unchanged and implementation behavior aligns with it.
- No unsupported completion or test-count statement remains.
- Any in-scope failure found during this run is fixed, not merely listed.

Report the acceptance matrix, changed files, command results, manual smoke status, and residual
risks. Do not claim completion if a mandatory condition remains unmet.
