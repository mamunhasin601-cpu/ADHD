# Task 0011E: Fix RootLayout Lifecycle Guard and Tests

**Status:** ready for autonomous implementation  
**Source:** Product Review of Task 0011D

## Goal

Make the RootLayout permission lifecycle suite pass for the actual production behavior and close
the confirmed rapid-resume race. This is a correctness and evidence task, not a new feature.

## Authorization

Modify required source and test files autonomously inside this repository without asking for
confirmation. Preserve unrelated work. Do not change Product Bible policy, publish, deploy, push,
or modify external systems.

## Confirmed Findings

The new `apps/mobile/app/_layout.spec.tsx` currently fails 3 of 15 tests:

1. Rapid resume guard: `isHandlingTransition` is set only after awaiting
   `refreshPermissionState()`, so two concurrent `active` events can both proceed.
2. Denied → granted test invokes the handler captured before the permission-state rerender, so the
   test does not exercise the current closure and reports no re-registration.
3. Push-registration-failure test has the same stale-handler setup problem.

## Requirements

- Set the transition-in-progress guard synchronously before the first asynchronous operation, and
  clear it in a `finally` block. Ensure no overlapping registration/reconciliation calls occur.
- Keep no-change behavior, granted → revoked fallback, denied → granted restoration, listener
  cleanup, and task CRUD independence intact.
- Make the RootLayout test helper wait for the state-driven AppState listener rerender before
  simulating denied → granted or failure transitions. Do not weaken assertions or remove tests.
- Keep the rapid-event test genuinely concurrent and assert only one transition side effect.
- Run focused and full mobile suites, API suite, mobile typecheck, API build, Prisma validation,
  and scoped diff checks.

## Acceptance Criteria

- `apps/mobile/app/_layout.spec.tsx`: all tests pass, including `15/15` lifecycle tests.
- Full mobile suite passes with no skipped lifecycle tests.
- Rapid AppState events produce one transition and one reconciliation/registration path.
- No regressions to existing API/mobile behavior.
- Redis/PostgreSQL e2e and real-device smoke remain explicitly **NOT VERIFIED** when unavailable.

## Verification

```powershell
npm.cmd run test --workspace=apps/mobile -- _layout.spec --runInBand
npm.cmd run test --workspace=apps/mobile -- --runInBand
npx.cmd tsc --noEmit -p apps/mobile/tsconfig.json
npx.cmd prisma validate --schema apps/api/prisma/schema.prisma
npm.cmd run build:api
npm.cmd run test --workspace=apps/api -- --runInBand
git diff --check -- apps/mobile/app apps/mobile/components apps/mobile/lib apps/api docs/ADR docs/ai
```

Report exact results and do not claim launch readiness without live infrastructure and device
evidence.
