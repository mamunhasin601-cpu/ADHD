# Task 0006B: Fix Recovery Picker and Success Boundaries

**Status:** ready
**Context:** correction required after review of Task 0006A
**Next:** Task 0007 only after independent acceptance

## Goal

Correct the remaining production boundary defects in the Recovery date/time picker and
post-mutation success flow. Preserve the explicit-destination UI, accessibility improvements,
accepted backend transaction behavior, and Inbox behavior from the current implementation.

## Confirmed defects

### 1. Native picker values are reinterpreted incorrectly

`DateTimePicker` exposes the calendar and clock values selected in the device timezone. The
current handlers pass its absolute `Date` through profile-timezone formatters before constructing
the destination. This changes the values the user selected when device and profile timezones
differ.

Reproduced example:

- device timezone: `Asia/Tokyo`;
- profile timezone: `America/New_York`;
- visible picker selection: `2026-08-05 09:00`;
- current code derives profile values `2026-08-04 20:00` and submits that wall-clock time.

Read the picker-selected calendar and clock fields as picker wall-clock fields, then interpret
those same fields in the profile IANA timezone. The visible selection, profile-timezone preview,
and submitted ISO instant must describe the same user choice.

### 2. Nonexistent DST times are silently changed

The current `localDateTimeToInstant` accepts `2026-03-08 02:30` in
`America/New_York`. `date-fns-tz` maps it to an instant that formats back as `01:30`, so the UI can
show one choice and submit another.

Validate timezone conversion by round-tripping the requested wall-clock fields. Reject or require
correction for nonexistent spring-forward times. Define and test one deterministic fall-back
ambiguity policy, and ensure preview and payload use the chosen occurrence consistently.

### 3. Invalid profile timezone crashes rendering

The current Today and Recovery formatting paths call `date-fns-tz` directly. An invalid IANA
timezone throws `RangeError: Invalid time value`. Replace this with a neutral, retryable state.
Do not silently schedule using the device timezone or an unrelated fallback timezone.

### 4. Partial success is mounted inside disappearing Recovery UI

The mutation hook invalidates the Recovery query on success. When the last overdue task is moved,
`hasOverdueTasks` becomes false and `RecoveryBanner` unmounts, so the partial reminder notice
inside that component cannot remain visible. When only a subset is moved, component selection can
remain stale after the task list changes.

Complete a coherent post-success flow:

- clear or close the submitted sheet state after a successful task move;
- never allow a moved task retained in local selection state to be submitted again;
- show `reminderSyncStatus: 'partial'` in a stable Today-level notice that remains visible after
  the Recovery list becomes empty;
- keep `partial` distinct from a failed task move;
- provide neutral actionable copy without task titles or IDs;
- support dismissal or another established non-blocking lifecycle for the notice.

## Required behavior

- Keep explicit Inbox as the only source of `targetStartTime: null`.
- Keep selected tasks destination-free until the user explicitly chooses Inbox or date/time.
- Keep confirmation disabled for missing, invalid, nonexistent, or past destinations.
- Device timezone must not alter picker calendar fields, clock fields, preview, or payload.
- Profile timezone must be the only timezone used to interpret the selected wall-clock fields.
- Opening and cancelling must perform no mutation; unselected tasks must remain unchanged.
- Preserve 44x44 touch targets, roles, states, modal semantics, and neutral Recovery language.

## Required boundary tests

Add tests that exercise production conversion functions and real components. Do not prove only
that the same absolute `Date` formats differently between zones.

Prove:

- a picker selection made under `Asia/Tokyo` device timezone retains the exact selected calendar
  and clock fields when interpreted for an `America/New_York` profile;
- the inverse east/west mismatch or another case that crosses midnight;
- exact ISO payload and exact profile-timezone preview for the mismatch cases;
- spring-forward nonexistent time is rejected and confirmation stays disabled;
- fall-back ambiguity follows the documented deterministic policy with an exact expected instant;
- invalid profile timezone produces a neutral retryable UI rather than an exception or silent
  fallback;
- `ok` success closes/resets submitted state;
- `partial` success remains visibly available after the final overdue task leaves the query;
- a subset success cannot resubmit a task removed by query invalidation;
- Recovery banner absent/present behavior is tested through the Today integration;
- the real mutation response, query invalidation, and Today notice are exercised through hooks or
  an integration harness.

Remove or correct tests that pass through tautological assertions. In particular, a spring-forward
test that merely expects no throw is not acceptance evidence, and a touch-target test must not use
`?? 44` in a way that passes when the style is absent.

## Constraints

- Keep the work scoped to Recovery mobile conversion, success state, supporting contracts, and
  their tests.
- Preserve unrelated changes in the dirty worktree.
- Do not change Product Bible policy, publish, deploy, push, or touch external systems.
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

Fix all in-scope failures before finishing. Do not claim emulator or device validation unless it
was actually performed.

## Definition of done

- Picker-selected wall-clock fields survive device/profile timezone differences unchanged.
- Nonexistent DST times and invalid IANA timezone data fail safely and visibly.
- Fall-back ambiguity has an exact deterministic contract and tests.
- `ok` and `partial` success remain correct after Recovery query invalidation and component
  unmount/list changes.
- Real Today, hook, component, and conversion boundary tests pass with exact assertions.
- All required verification commands pass.

