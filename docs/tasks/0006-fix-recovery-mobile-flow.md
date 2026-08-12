# Task 0006: Fix Recovery Scheduling and Reminder UX

**Status:** ready  
**Depends on:** `0005-add-recovery-inbox-path.md`  
**Next task:** `0007-finalize-recovery-acceptance.md`

## Execution directive

Implement this task in the current repository. You may use your normal engineering workflow and
autonomously inspect, create, or modify project files needed to complete it. Do not ask the user
for confirmation for routine in-repository changes; the product behavior and UX corrections below
are already approved.

You may create or modify mobile, shared-contract, supporting backend, test, dependency, and
engineering files inside the repository. Preserve unrelated work. Do not change Product Bible
policy or external systems.

## Goal

Replace the hard-coded device-local 09:00 behavior with an explicit timezone-correct destination
flow, surface partial reminder synchronization, and meet accessibility requirements.

## Explicit destination UX

- Every selected task must have an explicit destination before confirmation.
- Supported destinations are:
  - explicit Inbox (`targetStartTime: null`);
  - a user-selected valid Today/future date and time (`targetStartTime: ISO-8601`).
- Remove the `'today' -> device-local 09:00` alias and any silent destination default.
- Provide date/time controls using established project patterns or a small proven dependency.
- Disable confirmation until all selected tasks have valid destinations.
- Show the exact destination for every selected task before confirmation.
- Reject or require correction when a selected instant is already in the past.
- Cancel must write nothing.
- Unselected tasks must remain unchanged.

## Timezone correctness

- Use the user's stored IANA timezone returned by the server/profile for calendar-day meaning,
  conversion, and display.
- Do not use `toISOString().slice(0, 10)` for local calendar dates.
- Do not approximate future local days by adding fixed 24-hour milliseconds; that fails across
  DST transitions.
- Use a tested timezone conversion helper or proven timezone library. Add the dependency to the
  correct workspace package if needed.
- Handle device-timezone and profile-timezone differences deterministically.
- Add tests for UTC, a non-UTC zone, midnight, spring-forward, fall-back, and device/profile zone
  mismatch.

## Reminder partial-success UX

- Read the mutation response.
- When `reminderSyncStatus === 'partial'`, keep the task move successful and show neutral copy
  stating that some reminders could not be updated.
- Do not present the database mutation as failed.
- Keep retry/reconciliation guidance actionable and free of task titles or sensitive data.
- Test both `ok` and `partial` responses.

## Accessibility

- Provide at least 44x44 effective touch targets for selection and destination controls.
- Preserve checkbox/button roles, selected and disabled states, modal semantics, and useful
  screen-reader labels.
- Ensure long titles and localized date/time labels do not overlap controls.
- Keep recovery copy neutral, adult, and free from shame, debt, streak, or punishment language.

## Mobile tests

Add focused tests for:

- banner absent/present states;
- open without mutation;
- subset selection;
- explicit Inbox and explicit date/time destinations;
- preview, cancel, confirm, loading, and retry;
- confirmation disabled for missing/invalid/past destinations;
- Today/future timezone and DST conversion;
- `ok` and `partial` reminder responses;
- cache invalidation and no optimistic batch mutation;
- accessibility roles, states, and touch-target styles where testable.

## Required verification

Run mobile TypeScript, mobile tests, affected API tests, and `git diff --check`. Fix in-scope
failures before finishing. Do not mark manual emulator behavior as passed unless actually run.

## Definition of done

- No hard-coded 09:00 or implicit destination remains.
- User-selected Today/future scheduling is IANA-timezone and DST correct.
- Partial reminder failure is visible without undoing the task move.
- Required touch targets and accessibility semantics are present.
- Mobile recovery tests exist and pass.
- Source and test files are changed in this run.

Report changed files and verification results. Then stop; Task 0007 performs final documentation
and acceptance verification.
