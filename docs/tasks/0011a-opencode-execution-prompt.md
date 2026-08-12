# OpenCode Execution Prompt: Task 0011A

Execute `docs/tasks/0011a-complete-notification-integration.md` now.

This is an implementation task, not a review or planning exercise. Read the task completely and
make all required repository changes. You are authorized to autonomously create and modify files,
tests, migrations, ADRs, and engineering documentation anywhere inside this project without asking
the user for permission or confirmation. Preserve unrelated work. Do not publish, deploy, push,
commit, modify external systems, or change Product Bible policy.

The current Package 0011 result is not accepted. Passing API tests is insufficient because mobile
task mutations do not reconcile local reminders, the bootstrap query is unbounded, permission/tap
flows are missing, local and remote channels can duplicate, foreign tokens can be reassigned, partial
multi-device failures are not retried correctly, mobile/controller evidence is absent, and the e2e
spec still uses the legacy token/taskTitle contract.

Implement every Task 0011A requirement, add real regression evidence, run every available command,
and correct unsupported documentation claims. Do not stop at analysis or a plan. A response without
actual repository modifications is a failed execution. If Redis/PostgreSQL or a real device is
unavailable, report that evidence as **not verified** and do not claim launch readiness.
