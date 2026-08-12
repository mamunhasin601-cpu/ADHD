# OpenCode Execution Prompt: Implementation Package 0011

Execute `docs/tasks/0011-notification-reliability-mvp.md` now.

This is an implementation task, not a review or planning exercise. Read the package completely,
then autonomously create and modify the necessary files inside this repository. Do not ask the user
for permission or confirmation for routine in-project changes, migrations, tests, or documentation.
Preserve unrelated work. Do not publish, deploy, push, commit, modify external systems, or change
Product Bible policy.

Implement the complete Local + Remote Notifications MVP described by the package. The existing
BullMQ/Redis/Expo code is only a partial skeleton; do not declare the feature complete based on
existing unit tests alone. Add the required device-token lifecycle, privacy-safe generic payload,
local scheduling/reconciliation, cancellation, retry/deduplication, authenticated tests, and
documentation/ADR updates.

Do not stop at analysis or a plan. Make actual file changes, run every available verification
command, run Redis/PostgreSQL e2e and device smoke when the environment supports them, and report
unavailable infrastructure honestly as **not verified**. Preserve current Recovery behavior and
all existing test contracts. A response without repository file modifications is a failed
execution.
