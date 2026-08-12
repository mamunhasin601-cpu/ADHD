# Task 0011N: Execute Android Local-Fallback Smoke and Correct 0011M Evidence

**Status:** ready for autonomous execution  
**Source:** Product Review of Task 0011M

## Goal

Turn the available Android emulator into useful runtime evidence by building and installing Focus,
then execute every notification smoke row that does not require external Expo/FCM credentials.
Correct the inaccurate Task 0011M dependency blocker while preserving honest NOT VERIFIED status
for any remote-push-only row that still lacks credentials.

## User Problem

Package 0011 is blocked on device behavior, not repository-only tests. Task 0011M booted an emulator
but stopped before installing the app or exercising any matrix row. It also recorded that
`apps/mobile/node_modules` was absent, while subsequent repository inspection proved that directory
exists and npm resolves `expo`, `expo-notifications`, and `react-native` for the mobile workspace.

## Authorization

Work autonomously. Create and modify project files needed for Android smoke readiness, test
automation, evidence capture, and configuration correctness without asking for confirmation. You may
run the local API, Docker services, Metro, Gradle, Android emulator, and ADB; create disposable local
test users/tasks; and install/reinstall the debug app on the emulator.

Do not create an external Expo/Firebase project, purchase services, deploy to production, commit or
push git history, or place credentials/tokens/PII in tracked files. If valid credentials already
exist in the local environment or ignored configuration, use them without printing their values.

## Required Work

1. Re-run prerequisite checks from the repository root:
   - `npm.cmd ls expo expo-notifications react-native --workspace=apps/mobile --depth=0`;
   - verify `apps/mobile/node_modules` and `apps/mobile/android`;
   - run `npx.cmd expo config --type public` from `apps/mobile`;
   - run a strict JSON parse of `apps/mobile/app.json`.
2. Correct `apps/mobile/app.json` if it is not strict valid JSON, then confirm both strict parsing and
   Expo config resolution pass. Keep the existing product configuration unchanged except for fixes
   required for valid configuration or smoke execution.
3. Boot or reuse the `Pixel_5` AVD, verify it through ADB, and record its stable identity.
4. Start the repository's PostgreSQL/Redis/API prerequisites and prove the emulator can reach the API
   through `10.0.2.2`. Use only local development data.
5. Build and install `com.focus.adhd`, start Metro if the debug build requires it, launch the app, and
   prove the installed package/build identity.
6. Use a reproducible Android interaction method. Prefer an existing proven tool if available;
   otherwise use ADB plus UI hierarchy dumps, bounded coordinate input, screenshots, `dumpsys`, and
   redacted logcat. Do not treat the absence of Maestro/Detox/Appium as a reason to skip all rows.
7. Exercise and record every locally testable matrix row:
   - registration/sign-in and displayed profile timezone;
   - first notification permission grant;
   - first notification permission denial and absence of an automatic prompt loop;
   - grant through Android settings and app-resume reconciliation;
   - revoke through Android settings and app-resume cleanup/actionable banner;
   - local-fallback reminder creation with permission granted and remote registration unavailable;
   - task edit, completion, and deletion reschedule/cancellation behavior;
   - overdue Recovery destinations Today and Inbox;
   - emulator reboot and exactly-once local reminder restoration;
   - actual notification count, timestamps, local channel identity, and duplicate observation.
8. Capture evidence under `docs/evidence/0011n-android-smoke/`. Screenshots must not expose passwords,
   access tokens, push tokens, email addresses, or task content that is not disposable test data.
9. Check for existing usable Expo/FCM credentials without revealing them. If none exist, mark only
   remote-primary delivery and cross-channel duplicate verification NOT VERIFIED with the exact
   missing external prerequisite. Local-fallback results must not be presented as remote evidence.
10. Correct the inaccurate dependency statement from Task 0011M and append exact 0011N results to:
    - `docs/ADR/ADR-009-device-token-and-reminder-channels.md`;
    - `docs/ai/IMPLEMENTATION_STATE_v2.md`;
    - `docs/ai/NEXT_STEPS_v2.md`.

## Functional Requirements

- Notification permission transitions must be observed from Android runtime state and app UI.
- Scheduled notification identity/count must be obtained from runtime evidence, not inferred from
  unit tests.
- Every task mutation must be tied to an observed scheduled-notification change or an explicit fail.
- Reboot evidence must include state before reboot, boot completion, app/reminder state after reboot,
  and actual delivery/count.
- Every smoke row must be marked PASS, FAIL, or NOT VERIFIED with a reason and evidence reference.

## Non-functional Requirements

- Keep secrets and personal data out of logs, screenshots, docs, and git.
- Use deterministic disposable task names and near-future times.
- Do not weaken notification behavior to make the smoke pass.
- Do not claim remote delivery from a local notification.
- Keep background processes bounded and stop task-created Metro/API/emulator processes when finished
  unless they were already running before the task.

## Acceptance Criteria

- The false `apps/mobile/node_modules absent` claim is corrected against actual command output.
- `app.json` is strict valid JSON and `expo config` succeeds.
- Focus is built, installed, and launched on the recorded Android emulator.
- Every locally testable smoke row has runtime evidence and PASS/FAIL status.
- Local-fallback delivery, mutation cancellation/rescheduling, permission lifecycle, recovery, reboot,
  and duplicate count are actually observed, or each has a new exact technical failure with command
  output after the app was installed and launched.
- Remote-only rows remain NOT VERIFIED unless real existing credentials produce observed delivery.
- Status docs state whether Package 0011 remains NOT launch-ready and identify only the remaining
  evidence gap.
- Relevant mobile tests and typecheck pass after any project-file change.
- `git diff --check -- apps/mobile docs/ADR docs/ai docs/evidence` passes.

## Out of Scope

- Creating or configuring a new external Expo/Firebase account or cloud project.
- Production deployment or store submission.
- Changing Product Bible policy.
- Treating emulator observations as physical-device evidence.

## Final Report

Finish with:

- exact changed files;
- build/install commands and results;
- a row-by-row evidence table with artifact paths;
- test/typecheck results;
- remaining external prerequisites;
- process cleanup status.

