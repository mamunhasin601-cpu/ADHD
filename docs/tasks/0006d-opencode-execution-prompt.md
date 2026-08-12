# OpenCode Task Prompt: Close Recovery Test Lifecycle

Implement `docs/tasks/0006d-close-recovery-test-lifecycle.md` in the current repository.

You are authorized to inspect the repository and autonomously create or modify any in-project
files needed to complete this correction. Do not ask the user for confirmation for routine
repository changes. Use your normal engineering workflow, preserve unrelated work, and keep the
changes within the task scope. Do not modify Product Bible policy or external systems.

The current Recovery functionality is behaviorally green, but the mandatory mobile Jest command
hangs after all tests pass and emits React `act(...)` warnings. Diagnose and close the real async
resource or test lifecycle leak. Do not add `--forceExit`, hide the warning, or merely extend a
timeout. Keep the real production integration tests and run every verification command from the
task.

Report changed files, exact test results, and any validation that could not be performed. Do not
claim emulator or device testing unless it actually ran. Stop after Task 0006D; Task 0007 remains
separate.
