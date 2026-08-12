# OpenCode Task Prompt: Fix Recovery Picker and Success Boundaries

Implement `docs/tasks/0006b-fix-recovery-picker-and-success-boundaries.md` in the current
repository.

You are authorized to inspect the repository and autonomously create or modify any in-project
files needed to complete this correction. Do not ask the user for confirmation for routine
repository changes. Use your normal engineering workflow, preserve unrelated work, and keep the
changes within the task scope. Do not modify Product Bible policy or external systems.

Passing test counts are not sufficient by themselves. Reproduce and fix the device/profile picker
mismatch, validate DST wall-clock round trips and invalid IANA zones, and exercise the real
post-invalidation Today success flow so a partial reminder notice remains visible after the final
overdue task is removed.

Run every verification command in the task, fix all in-scope failures, and report changed files,
exact test results, and any validation that could not be performed. Do not claim emulator or
device testing unless it actually ran. Stop after Task 0006B; Task 0007 remains separate.
