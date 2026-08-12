# OpenCode Retry Prompt: Task 0011L

Execute `docs/tasks/0011l-verify-clean-database-migrations.md` now. The previous attempt made no
repository changes and produced no clean-database evidence, so Task 0011L is still not started.

Do not return a plan or analysis. Your first actions must be to inspect the current Docker state and
create an isolated disposable PostgreSQL test database/container that does not touch or reset the
shared `focus_db`. Then:

1. Point a temporary `DATABASE_URL` at the empty isolated database.
2. Run `prisma migrate deploy` and prove all four migrations apply in order.
3. Run `prisma migrate status` and a read-only `prisma migrate diff` against that same database.
4. Run notification e2e `3/3` against that clean database with live Redis.
5. Prove the original `focus_db` container/database/volume was not reset or deleted.
6. Update ADR-009, `docs/ai/IMPLEMENTATION_STATE_v2.md`, and `docs/ai/NEXT_STEPS_v2.md` with exact
   target identifiers, commands, results, and cleanup status.
7. Run `git diff --check -- docs/ADR docs/ai`.

Work autonomously and edit permitted repository documentation without asking for confirmation. Do
not modify production source, schema, migration SQL, Product Bible policy, deployments, or git
history. Never use `prisma db push`, `prisma migrate reset`, `docker compose down -v`, or any command
that can destroy the shared database. If safe isolation is impossible, update the evidence docs to
state **NOT VERIFIED** with the exact blocker instead of claiming completion. Real-device smoke must
remain **NOT VERIFIED**.
