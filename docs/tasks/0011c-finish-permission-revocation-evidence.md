# Task 0011C: Finish Permission Revocation Handling and Evidence

**Status:** ready for autonomous implementation  
**Source:** Product Review of Task 0011B

## Goal

Make notification permission changes reliable for the entire app session and add the missing UI
evidence. This is a correctness and test-evidence task, not a new feature.

## Authorization

Modify any required source, test, and documentation files inside this repository autonomously
without asking for confirmation. Preserve unrelated work. Do not change Product Bible policy,
publish, deploy, push, or modify external systems.

## Confirmed Finding

`apps/mobile/app/_layout.tsx` only calls `refreshPermissionState()` from the AppState listener when
`notifPermState === 'denied'`. If notifications were previously granted and the user revokes them
in OS settings while the app is backgrounded, the resume event is ignored. The app can remain in
remote-primary mode with no usable remote delivery and no local fallback.

## Requirements

- On every relevant app resume for an authenticated user, re-check the OS notification state without
  showing an automatic permission prompt.
- When a granted permission becomes denied/unavailable, update the visible neutral banner, switch
  the channel policy to the documented fallback behavior, and reconcile/cancel owned reminders
  safely. Task CRUD must remain usable.
- When the user restores permission in OS settings, re-register the device and restore the selected
  channel policy exactly once per state transition; avoid overlapping registration calls.
- Keep the existing no-automatic-prompt-after-denial rule and explicit settings action.
- Add a component test for `NotificationPermissionBanner`: neutral copy, settings action, and
  callback behavior. Add lifecycle tests for granted→revoked and denied→granted transitions.
- Update ADR/status documentation only if behavior or evidence claims change. Keep live
  Redis/PostgreSQL e2e and real-device smoke explicitly **NOT VERIFIED** when unavailable.

## Acceptance Criteria

- OS revocation after a previously granted state is detected on resume.
- Remote-primary is not retained when remote permission is unavailable.
- Restoring permission resumes registration/reconciliation without loops or duplicate calls.
- Banner interaction opens settings and is covered by a component test.
- API/mobile suites, typecheck, build, Prisma validation, and scoped diff checks pass.

## Verification

```powershell
npx.cmd prisma validate --schema apps/api/prisma/schema.prisma
npm.cmd run build:api
npm.cmd run test --workspace=apps/api -- --runInBand
npx.cmd tsc --noEmit -p apps/mobile/tsconfig.json
npm.cmd run test --workspace=apps/mobile -- --runInBand
git diff --check -- apps/mobile/app apps/mobile/components apps/mobile/lib docs/ADR docs/ai
```

Report exact results and keep unavailable infrastructure/device checks explicitly **NOT VERIFIED**.
