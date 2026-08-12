# OpenCode Resume Prompt: Task 0011N

Resume `docs/tasks/0011n-run-android-local-smoke.md` from the current repository state. The previous
session made partial progress and then stopped. Do not restart from analysis and do not return only a
status report.

## Verified Current State

- `apps/mobile/app.json` was corrected to strict JSON.
- `apps/mobile/metro.config.js` was added to exclude test files from the native bundle.
- The Android debug APK was built and `com.focus.adhd` was launched on `emulator-5554`.
- Partial UI hierarchy evidence exists through task creation under
  `docs/evidence/0011n-android-smoke/`.
- ADR-009, `IMPLEMENTATION_STATE_v2.md`, and `NEXT_STEPS_v2.md` have not yet been updated for 0011N.

## Defects in the Partial Attempt

1. `10-app-launched.png` is not a valid PNG. Its bytes begin with a UTF-16 BOM and interleaved null
   bytes because binary ADB output was redirected through PowerShell text encoding. Replace it and
   capture all later screenshots safely by writing on the device and using `adb pull`, for example:
   `adb shell screencap -p /sdcard/<name>.png`, then `adb pull /sdcard/<name>.png <evidence-path>`.
   Validate every PNG signature (`89 50 4E 47 0D 0A 1A 0A`) and open/render it before treating it as
   evidence.
2. `31-ui-after-save.xml` shows an unresolved runtime warning:
   `ExpoAsset.downloadAsync` could not download the Ionicons font from Metro at `10.0.2.2:8081`.
   Diagnose and fix the actual development/runtime configuration or connectivity cause. Do not hide
   the warning or count the affected row as PASS. Rebuild/reload as needed and prove the error is gone
   from the UI hierarchy and redacted logcat.
3. The task stopped before scheduled-notification evidence, edit/complete/delete, Recovery, reboot,
   actual delivery/count, duplicate checks, verification commands, evidence-doc updates, and process
   cleanup.
4. The Task 0011M statement that `apps/mobile/node_modules` is absent is still present in evidence
   docs and must be corrected using actual workspace command output.

## Continue Now

- Inspect and reuse valid partial artifacts; replace corrupt or misleading artifacts rather than
  claiming them.
- Restart the required Docker/API/Metro/emulator processes, build/reinstall only when necessary, and
  continue the row-by-row local-fallback matrix from the first unverified state.
- Capture explicit permission state, Focus-owned scheduled notification identifiers/counts, actual
  notification delivery, mutation cancellation/rescheduling, Recovery to Today and Inbox, reboot
  restoration, and duplicate count using ADB/UI hierarchy/dumpsys/redacted logcat plus valid PNGs.
- Use disposable test data. Never expose credentials, tokens, personal email, or passwords in tracked
  artifacts.
- Do not use any unrelated API key as an Expo/FCM credential. Remote-primary rows may pass only with
  existing valid Expo/FCM configuration and observed remote delivery; otherwise keep only those rows
  NOT VERIFIED.
- Make necessary in-project fixes autonomously without asking for confirmation. Run relevant mobile
  tests and typecheck after project-file changes.
- Update ADR-009, `docs/ai/IMPLEMENTATION_STATE_v2.md`, and `docs/ai/NEXT_STEPS_v2.md` with an honest
  0011N result even if a later row fails.
- Run `git diff --check -- apps/mobile docs/ADR docs/ai docs/evidence`.
- Stop only processes started by this task and record cleanup state.

Finish with the exact changed-file list, verification commands/results, a row-by-row evidence table
with artifact paths, remaining external prerequisites, and process cleanup status. The task is not
complete while the three evidence documents lack an 0011N entry.
