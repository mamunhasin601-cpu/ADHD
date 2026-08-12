# OpenCode Execution Prompt: Task 0011H

Read and execute `docs/tasks/0011h-verify-notification-launch-gates.md` now.

Work autonomously inside the repository and run the available verification commands without asking
for confirmation. Verify live Redis/PostgreSQL e2e, Prisma migration deployment/validation, and the
real-device notification smoke matrix. Do not modify source code, tests, Product Bible policy, or
deployments. If Docker, databases, or a device are unavailable, report the affected gate as
**NOT VERIFIED** with the exact reason and command; never claim success from mocks or a timeout.
Update only the permitted status/evidence documentation, keep Package 0011 not launch-ready unless
both live e2e and device smoke pass, and finish with a gate-by-gate evidence table plus exact
diff-check output.
