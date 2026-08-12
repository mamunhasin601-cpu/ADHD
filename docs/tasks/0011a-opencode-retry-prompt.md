# OpenCode Retry Prompt: Complete Task 0011A

Continue the implementation by reading and executing
`docs/tasks/0011a-complete-notification-integration.md`.

The previous completion report is not accepted. The absence of Redis, PostgreSQL, Docker, or a
device explains only why infrastructure e2e and device smoke cannot run. It does not block the
repository changes required by Task 0011A.

The repository still contains the pre-0011A implementation:

- mobile reminder reconciliation runs only during root bootstrap;
- bootstrap still uses an unbounded `GET /tasks` request;
- reconciliation still calls `cancelAllScheduledNotificationsAsync()`;
- permission recovery UI and notification-tap routing are missing;
- local and remote reminders still have no real cross-channel ownership policy;
- a device token can still be reassigned from another user;
- token/platform validation and controller HTTP evidence are still incomplete;
- partial multi-device failures still use task-level delivery state and lose failed devices;
- `notification-reliability.e2e-spec.ts` still uses legacy `expoPushToken` and `taskTitle`;
- ADR-009 still claims the incomplete behavior is implemented;
- the required mobile notification and authenticated controller tests are absent.

Make the required source, test, migration, ADR, and documentation changes autonomously inside the
project. Do not ask for confirmation before creating or modifying project files. Preserve unrelated
work and do not change Product Bible policy.

Run every verification command that is available in the current environment. If live
Redis/PostgreSQL e2e or device smoke is unavailable, report those two checks as **NOT VERIFIED**, but
complete and verify all repository-only work. Do not treat unavailable external infrastructure as a
reason to stop implementation.

Finish with a factual report listing changed files and exact command results. Do not report Task
0011A as complete unless the repository itself satisfies its acceptance criteria.
