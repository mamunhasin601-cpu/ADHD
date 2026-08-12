# OpenCode Execution Prompt: Task 0011N

Read and execute `docs/tasks/0011n-run-android-local-smoke.md` now.

Do not return only a plan or repeat Task 0011M's blockers. Work autonomously and make all necessary
in-project file changes without asking for confirmation. Re-check dependencies from the repository
root: the prior claim that `apps/mobile/node_modules` was absent is contradicted by the current
workspace, where the directory exists and npm resolves the mobile Expo dependencies.

Build and install Focus on the available Android emulator, run every locally testable notification
smoke row, and save redacted runtime artifacts under `docs/evidence/0011n-android-smoke/`. The absence
of Maestro/Detox/Appium is not by itself permission to skip the matrix; use available ADB/UI hierarchy,
screenshot, dumpsys, and logcat capabilities when a dedicated harness is unavailable. Do not claim
remote push without observed remote delivery.

Do not create external cloud projects, expose credentials, deploy, commit, or push. If existing local
Expo/FCM credentials are unavailable, keep only the remote-primary rows NOT VERIFIED and complete the
local-fallback matrix. Update ADR-009, `docs/ai/IMPLEMENTATION_STATE_v2.md`, and
`docs/ai/NEXT_STEPS_v2.md` with exact results even if a later runtime step fails. Finish with the
required evidence table, exact changed-file list, verification results, and cleanup status.
