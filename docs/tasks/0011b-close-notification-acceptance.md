# Task 0011B: Close Notification Acceptance Blockers

**Status:** ready for autonomous implementation  
**Source:** Product Review of Task 0011A

## Goal

Close the remaining repository-level blockers found during acceptance review of the notification
reliability implementation. Do not add a new product feature.

## Authorization

The implementer may autonomously create and modify source, tests, migrations, ADRs, and engineering
documentation anywhere inside this repository. Do not ask for confirmation for routine in-project
changes. Preserve unrelated work. Do not change Product Bible policy, publish, deploy, push, or
modify external systems.

## Confirmed Blockers

1. `apps/mobile/app/_layout.tsx` sends `scheduledFrom` and `scheduledTo`, but
   `GetTasksQueryDto` and `TasksService.findAll()` ignore them. Bootstrap is therefore still an
   unbounded server query.
2. Permission denial is not persisted or surfaced through actionable UI. A denied permission with
   `canAskAgain === true` can trigger another automatic system prompt whenever the authenticated
   bootstrap effect runs.
3. `scheduleLocalReminder(task, false)` returns before cancelling an existing Focus reminder. A
   device switching from local fallback to remote-primary can retain a stale local notification.
4. `NotificationsProcessor` performs a task-level dedup check before fan-out and logs only the first
   successful device. A retry can therefore skip devices that failed while another device succeeded,
   and the evidence does not prove per-device retry/idempotency.

## Requirements

### Bounded server projection

- Add strict, bounded `scheduledFrom` and `scheduledTo` ISO query fields to the production DTO.
- Apply both fields to the Prisma `startTime` filter, with explicit validation and a documented
  maximum horizon or equivalent server-side bound.
- Preserve existing `date`, `inbox`, `incomplete`, and `includeSubTasks` behavior.
- Add HTTP/service tests proving the bounds reach Prisma and unknown/invalid values are rejected.

### Permission state and user agency

- Model a stable denied/unavailable state for the installation.
- Do not call `requestPermissionsAsync()` automatically again after denial; retry only through an
  explicit user action or a documented OS-state change.
- Show neutral, actionable UI with an OS-settings or explicit retry path. Notification failure must
  never block task CRUD.
- Add mobile tests for first denial, permanent denial, no automatic loop, explicit retry, and UI.

### Local fallback cleanup

- When remote-primary mode is selected, cancel any existing Focus-owned local reminder for each
  affected task before returning.
- Keep cancellation owned-only and preserve unrelated scheduled notifications.
- Add regression tests for switching local fallback to remote-primary during create/update/toggle,
  recovery reschedule, and bootstrap.

### Per-device delivery retry and deduplication

- Remove the processor's task-global precheck for the multi-device path, or replace it with a
  persistent per-task/start/device idempotency decision.
- Persist an outcome for every attempted device, including retryable failure and invalid token.
- On retry, send only devices not already recorded as delivered for the same task/start/device
  identity. Never suppress an undelivered device because another device succeeded.
- Revoke only `DeviceNotRegistered` devices. Keep logs privacy-safe and do not expose tokens.
- Add service/processor tests for success+retryable failure, retry without duplicate success,
  success+invalid token, and per-device dedup. Update e2e assertions accordingly.

## Acceptance Criteria

- The bootstrap request is bounded and the server enforces the requested projection.
- Permission denial is neutral, actionable, and non-looping.
- Switching to remote-primary cannot leave a stale Focus local reminder.
- Partial fan-out retries failed devices without repeating successful devices.
- All existing API/mobile tests pass, plus the new regression tests.
- Redis/PostgreSQL e2e and device smoke remain explicitly **NOT VERIFIED** when unavailable; do not
  claim launch readiness without that evidence.

## Verification

```powershell
npx.cmd prisma validate --schema apps/api/prisma/schema.prisma
npx.cmd prisma generate --schema apps/api/prisma/schema.prisma
npm.cmd run build:api
npm.cmd run test --workspace=apps/api -- --runInBand
npx.cmd tsc --noEmit -p apps/mobile/tsconfig.json
npm.cmd run test --workspace=apps/mobile -- --runInBand
npm.cmd run test:e2e --workspace=apps/api -- --runInBand
git diff --check
```

Report exact results and keep unavailable infrastructure/device checks explicitly **NOT VERIFIED**.
