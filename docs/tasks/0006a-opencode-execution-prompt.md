# OpenCode Task Prompt: Complete the Recovery Mobile Flow

Implement `docs/tasks/0006a-complete-recovery-mobile-flow.md` in the current repository.

You are authorized to inspect the repository and autonomously create or modify any in-project
files needed to complete this correction. Do not ask the user for confirmation for routine
repository file changes. Use your normal engineering workflow, preserve unrelated work, and keep
the changes within the task scope. Do not modify Product Bible policy or external systems.

Treat the passing tests as insufficient evidence: the current production Recovery flow still uses
the forbidden implicit `today -> 09:00` path, while the existing RecoveryBanner tests copy that
logic instead of rendering the component. Correct the production flow first, then replace the
copied tests with genuine component, hook, and Today integration evidence.

Run every verification command from the task, fix all in-scope failures, and report changed files,
exact test results, and any validation that could not be performed. Do not claim emulator or
device testing unless it was actually run. Stop after Task 0006A; Task 0007 remains separate.
