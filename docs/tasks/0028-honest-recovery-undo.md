# Task 0028 — Honest Recovery undo

**Status:** completed by automated validation; Android runtime remains **NOT VERIFIED**.

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
inside the restore transaction, making rapid duplicate requests safe.

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

## Validation

Focused API tests cover exact instant and null restoration, owner isolation,
expiry, replay, stale rollback, commit-before-reminder behavior, and honest
partial reminder reporting. Existing Recovery tests retain transaction,
eligibility, multi-item, and `REST`/`BUFFER` exclusion coverage. Mobile
integration covers banner-remount persistence, accessible Undo, duplicate taps,
success copy, and broad cache invalidation; existing lifecycle suites exercise
auth replacement and unmount boundaries.

Android emulator/device evidence was not produced for this change. Jest is not
runtime evidence, therefore Android runtime remains **NOT VERIFIED**.
