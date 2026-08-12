# OpenCode Execution Prompt: Task 0011J

Read and execute `docs/tasks/0011j-reconcile-user-schema-migration-drift.md` now.

Act autonomously inside the repository. Create the additive Prisma migration required to reconcile
the current `User` schema with PostgreSQL: `Plan` enum (`FREE`, `PRO`), onboarding flag, plan and
expiry fields, three OAuth provider IDs, and their unique indexes. Never rewrite applied migrations,
use `db push`, modify Product Bible policy, or ask for confirmation. Run generate, migrate deploy,
migrate status, read-only schema diff, API e2e, API tests, and API build. Update only permitted status
evidence documentation. If live infrastructure is unavailable, report that gate as FAILED/NOT
VERIFIED with exact output; do not claim launch readiness or device smoke success.
