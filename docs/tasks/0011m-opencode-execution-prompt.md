# OpenCode Execution Prompt: Task 0011M

Read and execute `docs/tasks/0011m-run-android-device-smoke.md` now.

Run the complete Android notification smoke matrix autonomously on a real device or emulator. Do not
modify production behavior, tests, Product Bible policy, or deployments. Record build/device identity,
permission grant/deny/revoke/restore, task lifecycle, recovery, reboot, cancellation, channel choice,
actual notification counts, and duplicate observations with timestamps and redacted logs. If Android
tooling or a device is unavailable, record the exact blocker as **NOT VERIFIED** without claiming
success. In either outcome, update ADR-009, `docs/ai/IMPLEMENTATION_STATE_v2.md`, and
`docs/ai/NEXT_STEPS_v2.md`; do not return only a chat report. Work autonomously and do not ask for
confirmation for in-scope project commands or these documentation edits. Run
`git diff --check -- docs/ADR docs/ai` and finish with an evidence table plus the exact changed-file
list. Retain **NOT launch-ready** until every required gate passes.
