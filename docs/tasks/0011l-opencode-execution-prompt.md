# OpenCode Execution Prompt: Task 0011L

Read and execute `docs/tasks/0011l-verify-clean-database-migrations.md` now.

Work autonomously. Use an isolated disposable PostgreSQL database/container, apply every migration
from empty with `prisma migrate deploy`, verify status and read-only schema diff, then run notification
e2e with live Redis. Never reset or delete the shared `focus_db`, rewrite migrations, use `db push`,
modify production code, or ask for confirmation. If a clean database is unavailable, report the gate
as **NOT VERIFIED** with the exact prerequisite. Update only permitted evidence docs and preserve
real-device smoke **NOT VERIFIED**. Finish with exact commands, target database identifiers, and
diff-check output.
