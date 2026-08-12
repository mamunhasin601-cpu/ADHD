# OpenCode Execution Prompt: Task 0011I

Read and execute `docs/tasks/0011i-harden-e2e-gate-and-correct-evidence.md` now.

Work autonomously inside the repository. You may modify the notification e2e test harness and the
specified status documentation, but do not modify production behavior, Product Bible policy,
deployments, or git history. Make the e2e suite fail cleanly and within a bounded time when
Redis/PostgreSQL are unavailable: guard partial setup, close only initialized resources, and remove
the secondary teardown TypeError/open-handle hang. Keep infrastructure failure non-zero. Then correct
Task 0011H wording so attempted e2e/migration gates are **FAILED** and the unrun real-device gate is
**NOT VERIFIED**; retain **NOT launch-ready**. Run the requested checks and finish with exact output,
including the unavailable-infrastructure case. Do not ask for confirmation before editing in-project
files.
