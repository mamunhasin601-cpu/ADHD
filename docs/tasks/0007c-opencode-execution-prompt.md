# OpenCode Execution Prompt: Task 0007C

Execute `docs/tasks/0007c-close-auth-test-and-docs.md` now.

This repository work is pre-approved. You may autonomously create or modify any files inside the
repository required by the task without asking the user for permission or confirmation. Preserve
unrelated changes. Do not publish, deploy, push, modify external systems, or change Product Bible
policy.

Implement the task completely. Do not stop after analysis or a plan. First fix the auth integration
test isolation so queued one-time mock implementations cannot leak between tests. Then run the
focused suite before updating documentation with the actual verified counts.

Complete every documentation requirement in the task. Do not leave duplicate `132/156` current
results or the old local-day-start destination rule. Keep PostgreSQL/Redis e2e and device smoke
explicitly marked **not verified**.

Run all verification commands exactly as listed. Do not use `--forceExit`, skipped tests, weakened
assertions, or artificial timeouts. Fix any task-caused failure within the repository and rerun the
failed command.

Report the changed files, exact test counts, documentation updates, unavailable checks, and
residual risks, then stop.
