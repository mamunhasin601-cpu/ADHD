# OpenCode Execution Prompt: Task 0011B

Read and execute `docs/tasks/0011b-close-notification-acceptance.md` now.

This is an implementation task. The previous Task 0011A report is only partially accepted because
four repository-level blockers remain: the server ignores the bounded bootstrap query, permission
denial has no actionable non-looping state, remote-primary mode can leave stale local reminders, and
the notification processor still uses task-global dedup instead of complete per-device retry state.

You are authorized to autonomously create and modify all required files inside this project without
asking for confirmation. Make the actual source, test, and documentation changes; do not stop at
analysis or a plan. Preserve unrelated work and do not change Product Bible policy.

Run all available repository-only verification commands. Redis/PostgreSQL e2e and real-device smoke
may be unavailable; in that case report those checks as **NOT VERIFIED**, but do not use that as a
reason to stop the implementation or to skip the internal acceptance criteria.

Finish with changed files, exact test/build results, remaining risks, and a truthful completion
status. Do not claim Task 0011B is complete unless its acceptance criteria are satisfied.
