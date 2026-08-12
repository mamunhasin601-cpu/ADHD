# Task 0011D: Prove Permission Lifecycle Integration

**Status:** ready for autonomous implementation  
**Source:** Product Review of Task 0011C

## Goal

Add executable integration evidence for the RootLayout notification-permission lifecycle. The
runtime implementation is present, but the critical AppState transitions are not covered by a
RootLayout test.

## Authorization

Modify any required source, test, and documentation files inside this repository autonomously
without asking for confirmation. Preserve unrelated work. Do not change Product Bible policy,
publish, deploy, push, or modify external systems.

## Confirmed Evidence Gap

The repository has `notification-permission.spec.ts` and
`NotificationPermissionBanner.spec.tsx`, but no RootLayout/AppState integration test. Therefore the
following acceptance boundaries are not proven:

- granted → revoked on app resume switches to local fallback and reconciles owned reminders;
- denied → granted after OS settings re-registers the device and restores remote-primary;
- rapid resume events do not overlap registration/reconciliation calls;
- task CRUD remains independent of permission transition failures.

## Requirements

- Add a focused RootLayout integration test with mocked AppState, Notifications, SecureStore,
  API client, router, and auth store using the production component/module boundaries.
- Prove granted → revoked: `refreshPermissionState()` returns denied, the neutral banner appears,
  local fallback is selected, and owned reminders are reconciled without a second permission prompt.
- Prove denied → granted: OS refresh returns granted, registration occurs once, remote-primary is
  restored, and bounded bootstrap query parameters are sent.
- Prove listener cleanup and rapid duplicate `active` events do not cause overlapping calls.
- Keep tests deterministic and preserve all existing API/mobile tests.
- If the tests expose a runtime defect, fix the smallest required production surface and document
  the behavior in ADR/status docs.

## Acceptance Criteria

- RootLayout lifecycle tests cover both permission directions, listener cleanup, and no-loop behavior.
- Test assertions prove channel policy and bounded query side effects, not only helper return values.
- API build, Prisma validation, mobile typecheck, full API/mobile suites, and scoped diff checks pass.
- Redis/PostgreSQL e2e and real-device smoke remain explicitly **NOT VERIFIED** when unavailable.

## Verification

```powershell
npx.cmd prisma validate --schema apps/api/prisma/schema.prisma
npm.cmd run build:api
npm.cmd run test --workspace=apps/api -- --runInBand
npx.cmd tsc --noEmit -p apps/mobile/tsconfig.json
npm.cmd run test --workspace=apps/mobile -- --runInBand
git diff --check -- apps/mobile/app apps/mobile/components apps/mobile/lib docs/ADR docs/ai
```

Report exact results and do not claim device/e2e verification without live infrastructure and a
real device.
