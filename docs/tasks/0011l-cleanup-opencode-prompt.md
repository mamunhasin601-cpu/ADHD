# OpenCode Execution Prompt: Task 0011L Cleanup Follow-up

Read and execute `docs/tasks/0011l-cleanup-followup.md` now.

Do not return only a plan or analysis. Inspect the exact Docker resources, perform the authorized
cleanup when it is safe, verify that the shared Focus database resources remain intact, and update
all three required evidence documents. Work autonomously and do not ask for confirmation for
actions within the task scope.

Only the disposable Task 0011L container and its proven-unused anonymous volume may be removed.
Never modify or remove `focus_postgres`, `focus_redis`, `adhd_postgres_data`, or `focus_db`. Do not
edit production source, tests, schema, migrations, Product Bible policy, package files, deployments,
or git history. Do not use broad prune/reset/down commands. If a resource cannot be identified
safely, document the exact blocker instead of claiming cleanup.

Finish with the required evidence table and the exact list of changed files.
