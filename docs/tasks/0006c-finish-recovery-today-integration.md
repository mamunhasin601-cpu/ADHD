# Task 0006C: Finish Recovery Today Integration

**Status:** ready
**Context:** final correction required after review of Task 0006B
**Next:** Task 0007 only after independent acceptance

## Goal

Close the remaining Today-level Recovery acceptance gaps without redesigning the corrected picker,
DST validation, explicit destination flow, or accepted backend behavior.

## Confirmed remaining defects

### 1. Invalid or unavailable profile timezone still breaks Today

`RecoveryBanner` now has an invalid-timezone guard, but `TodayScreen` calls
`getLocalDateString` and `todayLocalDateString` first while calculating `isToday`. An invalid IANA
timezone therefore throws `RangeError: Invalid time value` before the guarded Recovery UI can
render. Today also substitutes `UTC` when the profile timezone is unavailable, which can silently
select the wrong Recovery day near midnight.

Validate profile timezone before every Today/Recovery formatter call. When the profile timezone is
missing or invalid:

- do not calculate Recovery day boundaries with UTC or the device timezone;
- do not enable Recovery queries or scheduling;
- keep the rest of Today stable where practical;
- show a neutral, actionable, retryable/profile-settings state;
- never crash the screen.

### 2. Partial reminder copy promises behavior that does not exist

`PartialReminderNotice` says failed reminders will synchronize automatically at the next
connection. The current backend catches queue scheduling failures, reports `partial`, and does not
persist a reconciliation request or retry it on a future client connection. Remove that unsupported
promise.

Use truthful neutral copy: the task move succeeded, some reminders were not updated, and the user
can review or resave reminder settings for the moved tasks. Do not include task titles or IDs and do
not describe the task move as failed.

### 3. Today integration evidence is still absent

The new tests cover `RecoveryBanner`, timezone helpers, and `PartialReminderNotice` in isolation.
There is no test that renders `TodayScreen` or an equivalent extracted production integration and
proves the mutation callback, query update, banner lifecycle, and stable notice together.

Add genuine integration evidence that uses production Today coordination code. Prove:

- Recovery banner is absent without overdue tasks and present with overdue tasks;
- opening and cancelling perform no mutation;
- an `ok` response resets/closes submitted Recovery state and does not show the partial notice;
- a `partial` response resets submitted state and shows the Today-level notice;
- the partial notice remains visible after the Recovery query updates to an empty task list and
  the RecoveryBanner unmounts;
- a subset success cannot resubmit a task removed by query invalidation;
- dismissing the notice removes it;
- mutation payload and required recovery/today/inbox invalidations use the production hook path;
- missing or invalid profile timezone does not call the Recovery query and produces the neutral
  recoverable state.

Mocks may isolate navigation, timeline, native picker, and HTTP boundaries, but the test must render
the real Today coordination component or an extracted production coordinator used by Today. Do not
reimplement the callback or state machine inside the test.

## Timezone validation hardening

When validating a selected wall-clock value, round-trip both the calendar date and clock fields.
This avoids accepting zones that skip or shift a local date at midnight. Keep the exact tested
first-occurrence policy for fall-back ambiguity and the existing rejection of spring-forward gaps.

## Constraints

- Preserve the corrected device/profile picker field extraction.
- Preserve explicit Inbox null semantics, destination validation, 44x44 targets, and accessibility
  states.
- Preserve accepted backend transaction and Inbox behavior.
- Keep changes narrowly scoped to Today/Recovery state, timezone guards, copy, and tests.
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

Fix all in-scope failures. Do not claim emulator or device validation unless it was actually
performed.

## Definition of done

- Missing or invalid profile timezone cannot crash Today or silently schedule in another zone.
- Partial reminder copy matches actual backend guarantees.
- A real Today integration test proves banner, mutation, invalidation, reset, unmount, persistent
  partial notice, dismissal, and invalid-timezone behavior.
- Date and time fields both participate in timezone round-trip validation.
- All required verification commands pass.

