# Task 0028 — Honest Recovery undo

**Status:** completed by automated validation and Android emulator happy-path verification.

## Product boundary

Recovery now returns a calm, visible confirmation on Today after the move has
committed. Its `Отменить` action is owned by `RecoverySection`, outside the
remounting banner, and remains available for the server-defined 15-minute
window. Undo never starts, completes, deletes, navigates, or edits a task beyond
restoring `startTime`.

## Authoritative contract

The apply transaction creates an owner-scoped `RecoveryUndo` identity and one
server snapshot per selected ordinary task. Each item records the exact prior
nullable timestamp, the applied timestamp, and the authoritative `updatedAt`
written by Recovery. The client supplies only the opaque UUID.

`POST /tasks/recovery/undo` claims the identity once and restores every item in
one transaction. Ownership is checked before revealing state. An expired unused
identity returns `RECOVERY_UNDO_EXPIRED`; a task whose timestamp or `updatedAt`
changed returns `RECOVERY_UNDO_STALE` and rolls back the whole restore; replay of
a consumed identity returns `already-undone` without another write. The claim is
inside the restore transaction, making rapid duplicate requests safe. A replay
does not write task state again: it reads the tasks' current authoritative
values, reconciles reminders again, and reports that attempt's real `ok` or
`partial` result. Thus a lost first response remains recoverable without hiding
reminder failure or overwriting a task edited after the first Undo.

Only Recovery-eligible `TASK` roots are snapshotted, so unselected tasks and
`REST`/`BUFFER` records never enter undo. The narrow update changes only
`startTime`; exact PostgreSQL millisecond timestamps and `null` are preserved.

## Reminder and lifecycle truth

Server and local reminder reconciliation begins only after the restore commits.
Failures do not falsify or roll back task restoration: the response reports
`partial` and affected task identities. Mobile invalidates Today, Thoughts,
Recovery, and all dated task keys, then reconciles local reminders from the
restored server response.

Apply and Undo continuations are guarded by mounted ownership, authenticated
owner, auth `sessionGeneration`, and monotonically increasing operation
identity. Busy state and operation identity prevent duplicate taps; a newer
operation supersedes an older notice. Success, expired, stale, partial, and
generic failure use calm accessible live-region copy.

React 18 development effect replay explicitly reacquires mounted ownership.
Any owner-id or `sessionGeneration` replacement invalidates pending operations,
clears Undo, busy, error, and partial state, and prevents stale continuations
from touching replacement-session UI or caches.

## Validation

Focused API tests cover exact instant and null restoration, owner isolation,
expiry, replay, stale rollback, commit-before-reminder behavior, and honest
partial reminder reporting. Existing Recovery tests retain transaction,
eligibility, multi-item, and `REST`/`BUFFER` exclusion coverage. Mobile
integration covers banner-remount persistence, accessible Undo, duplicate taps,
success copy, and broad cache invalidation; existing lifecycle suites exercise
auth replacement and unmount boundaries.

### Android runtime evidence — 2026-08-23

The Recovery Apply/Undo happy path was verified on a Pixel 7 Android emulator
while the API, PostgreSQL, Redis, Metro, and Android development build were
running:

- Recovery moved exactly one scheduled `TASK` to Thoughts.
- A persistent accessible `Отменить` action appeared outside the Recovery modal.
- `POST /tasks/recovery/undo` returned HTTP 200.
- The Recovery count changed from 6 to 5 after Apply and returned to 6 after Undo.
- The exact original `startTime` `2026-08-22T10:00:00` was restored.
- The authoritative undo identity received a non-null `consumedAt`.
- `reminderSyncStatus` was `ok` and `failedReminderSyncs` was empty.
- No API runtime errors occurred during the Apply/Undo flow.

Android emulator runtime for the Recovery Apply/Undo happy path: VERIFIED.
Physical-device validation and Android runtime for expiry, stale-write, partial-reminder, and session-replacement failure paths: NOT VERIFIED.
