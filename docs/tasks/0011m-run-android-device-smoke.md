# Task 0011M: Run Android Notification Device Smoke

**Status:** ready for autonomous implementation  
**Source:** Product Review of Package 0011

## Goal

Obtain real Android runtime evidence for notification permission lifecycle, channel policy, recovery,
reboot handling, and duplicate-delivery behavior.

## Authorization

Run the smoke workflow autonomously on an available physical Android device or Android emulator and
update evidence documentation. Do not change notification behavior, Product Bible policy, or deploy
to production. Do not ask for confirmation for in-scope project commands or evidence-document edits.
If no device/emulator is available, record the exact blocker as **NOT VERIFIED** rather than
simulating it.

## Smoke Matrix

- Sign in and confirm profile timezone.
- Grant notification permission; register push token; create a future task; verify one reminder.
- Deny permission; verify the actionable permission state and no repeated permission prompt.
- Re-grant permission through system settings; resume the app; verify registration/reconciliation.
- Revoke permission through system settings; resume the app; verify Focus reminders are cancelled,
  no phantom local schedule is created, and the recovery banner remains actionable.
- Edit, complete, and delete a future task; verify reminder reschedule/cancellation.
- Reschedule an overdue task through Recovery to Today and Inbox; verify destination and reminder.
- Reboot the device; verify reminders are restored exactly once.
- Observe notification count, timestamps, remote/local channel, and duplicate delivery behavior.

## Acceptance Criteria

- A real Android device/emulator and build identity are recorded.
- Every matrix step has pass/fail evidence, including screenshots or logs where observable.
- No duplicate user-visible notification is observed for one task instant.
- Permission grant/deny/revoke/restore behavior matches ADR-009 D-10.
- Task mutation, recovery, reboot, cancellation, and channel fallback behavior are recorded.
- If any prerequisite is missing, the affected steps remain **NOT VERIFIED** and Package 0011 remains
  **NOT launch-ready**.
- No source code is changed solely to make the smoke pass.

## Evidence

Record Android version/model, app build, API URL, timestamps, notification counts, `adb logcat`
excerpts (without tokens/PII), and residual risks. Keep real-device evidence separate from Jest and
live e2e evidence. Update all three evidence documents with the observed result, including an exact
blocker when the matrix cannot run:

- `docs/ADR/ADR-009-device-token-and-reminder-channels.md`
- `docs/ai/IMPLEMENTATION_STATE_v2.md`
- `docs/ai/NEXT_STEPS_v2.md`

Run `git diff --check -- docs/ADR docs/ai` after editing. Do not claim Package 0011 launch-ready
unless every required smoke-matrix row passes with real runtime evidence.
