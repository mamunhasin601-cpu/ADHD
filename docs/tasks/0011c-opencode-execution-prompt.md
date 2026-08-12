# OpenCode Execution Prompt: Task 0011C

Read and execute `docs/tasks/0011c-finish-permission-revocation-evidence.md` now.

Task 0011B is mostly complete, but its permission lifecycle still misses one runtime transition:
the AppState listener ignores a grant→revocation change because it refreshes only when the current
state is already denied. This can leave remote-primary selected after OS permission is revoked.
The repository also lacks a component test for the actionable permission banner.

Implement the actual source and test changes autonomously inside the project. Do not ask for
confirmation, do not stop at analysis, preserve unrelated work, and do not change Product Bible
policy. Run all repository-only verification commands. Redis/PostgreSQL e2e and real-device smoke
may remain **NOT VERIFIED** when unavailable, but that does not excuse skipping internal changes.

Finish with changed files, exact results, residual risks, and a truthful completion status.
