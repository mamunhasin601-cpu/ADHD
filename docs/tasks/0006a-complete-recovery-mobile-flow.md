# Task 0006A: Complete the Recovery Mobile Flow

**Status:** ready
**Context:** correction required after review of Task 0006
**Next:** Task 0007 only after independent acceptance

## Goal

Complete the production Recovery flow required by Task 0006. The current implementation added
timezone helpers and passing helper tests, but the real `RecoveryBanner` and Today integration
still use the superseded implicit `today -> 09:00` behavior.

## Confirmed review blockers

1. `RecoveryBanner.tsx` still defines a `'today'` destination, initializes every task to it, and
   falls back to it when a destination is missing.
2. `today.tsx` still converts `'today'` by adding nine fixed hours to `localDayStart`. This is
   incorrect across DST transitions and violates Task 0006.
3. No production date/time controls exist. The installed DateTimePicker and the new timezone
   helpers are not used by the Recovery UI.
4. Confirmation is enabled as soon as a task is selected. It does not require a destination or
   reject a destination that is already in the past.
5. Destination and overdue-date labels use the device timezone because no explicit profile IANA
   timezone is passed to their formatters.
6. Recovery visibility and query date construction still depend on device-local comparisons and
   `toISOString().slice(0, 10)`, so a device/profile timezone mismatch is not resolved.
7. The mutation success handler ignores `reminderSyncStatus`. A `partial` response is
   indistinguishable from a fully synchronized result.
8. The checkbox is 24x24 and destination pills are below the required 44x44 effective touch
   target.
9. `RecoveryBanner.spec.ts` does not import or render `RecoveryBanner`; it duplicates the old
   mapping and formatting logic and therefore passes while the production flow is incorrect.
10. There is no real component/hook/Today integration evidence for selection, explicit
    destinations, partial success, invalid destinations, or accessibility states.

## Required product behavior

- Remove the `'today'` destination alias from production types, state, mapping, copy, and tests.
- A selected task starts with no destination. It must receive one of these explicit values:
  - Inbox, serialized only as `targetStartTime: null`;
  - a user-selected valid Today/future calendar date and wall-clock time, serialized as an
    ISO-8601 instant.
- Provide usable date and time controls for every selected task. Reuse the installed picker if it
  fits the Expo version, or choose the smallest compatible established approach.
- Show the exact profile-timezone destination for every selected task before confirmation.
- Disable confirmation until every selected task has a valid explicit destination strictly after
  the current instant. Cancel and opening the flow must perform no mutation.
- Do not mutate unselected tasks.
- Detect nonexistent DST wall-clock times rather than silently showing one time and submitting
  another. Handle fall-back ambiguity deterministically and keep preview and submitted instant
  consistent.

## Timezone requirements

- Connect the production UI to tested timezone conversion and formatting code.
- Use the stored profile IANA timezone returned by the server/profile for date meaning,
  conversion, preview, overdue labels, and Recovery visibility.
- Eliminate fixed-hour and fixed-24-hour calendar arithmetic from this flow.
- Eliminate `toISOString().slice(0, 10)` from Recovery query/cache date construction.
- Device timezone must not change the selected calendar date, submitted instant, or displayed
  profile-timezone destination.
- Invalid IANA timezone data must fail safely with a neutral retryable state; do not silently
  schedule using an unrelated device timezone.

## Partial reminder synchronization

- Read the real `RescheduleRecoveryResponse` returned by the mutation.
- For `reminderSyncStatus: 'ok'`, complete the normal success flow.
- For `reminderSyncStatus: 'partial'`, keep the task move successful and show visible neutral copy
  explaining that some reminders could not be updated and what the user can do next.
- Do not display task titles, IDs, or other sensitive details from `failedReminderSyncs`.
- Do not represent a committed task move as a failed mutation.

## Accessibility and layout

- Give selection, date, time, Inbox, cancel, and confirm controls at least 44x44 effective touch
  targets.
- Preserve modal semantics, checkbox/button roles, checked/selected/disabled/busy states, and
  useful labels that include task context where needed.
- Long task titles and localized date/time labels must wrap or truncate without overlapping
  controls.
- Keep all Recovery language neutral, adult, and free from shame, debt, streak, or punishment
  framing.

## Required tests

Replace copied production logic in `RecoveryBanner.spec.ts` with tests that import and render the
real component. Add focused hook or Today integration tests where the behavior belongs outside
the component.

Prove:

- banner absent and present states;
- opening performs no mutation;
- subset selection leaves unselected tasks untouched;
- selection alone does not create a destination;
- explicit Inbox and explicit date/time destinations;
- exact preview and submitted payload in the profile timezone;
- cancel, confirm, loading, server error, retry, and past/invalid destination states;
- confirmation remains disabled until all selected tasks have valid destinations;
- UTC, a non-UTC zone, midnight, spring-forward, fall-back, and device/profile mismatch;
- both `ok` and `partial` mutation responses and visible partial-success copy;
- required cache invalidation without optimistic batch mutation;
- roles, checked/selected/disabled/busy states, and 44x44 touch-target styles.

Tests must call production helpers and render production components. Do not reproduce the
implementation as local test-only functions.

## Constraints

- Preserve the accepted backend transaction safety and Inbox behavior.
- Do not redesign unrelated Today, task, or Inbox surfaces.
- Preserve unrelated work in the dirty worktree.
- Do not modify Product Bible policy, publish, deploy, push, or touch external systems.
- Do not begin Task 0007.

## Verification

Run and report exact results for:

```powershell
npx.cmd tsc --noEmit -p apps/mobile/tsconfig.json
npm.cmd run test --workspace=apps/mobile -- --runInBand
npm.cmd run build:api
npm.cmd run test:api -- --runInBand
git diff --check -- apps/mobile apps/api/src/tasks packages/shared-types/src/index.ts apps/mobile/package.json apps/api/package.json package-lock.json
```

Fix all in-scope failures before finishing. Report manual emulator/device validation only if it
was actually performed.

## Definition of done

- The production Recovery flow contains no `'today'` alias, hard-coded 09:00, silent destination
  default, fixed-hour day calculation, or Recovery `toISOString().slice(0, 10)` date key.
- Every selected task has an explicit valid destination before confirmation.
- Real UI controls submit timezone-correct ISO instants and explicit Inbox nulls.
- Partial reminder synchronization is visibly distinguished from task-move failure.
- Touch targets and accessibility state meet the Task 0006 requirements.
- Real component, hook, and integration tests demonstrate the behavior and all required commands
  pass.
