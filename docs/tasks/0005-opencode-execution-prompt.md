# OpenCode Task Prompt: Implement the Recovery Inbox Path

Work on `docs/tasks/0005-add-recovery-inbox-path.md` and implement the task in the repository.

You have permission to inspect the existing architecture and to create or modify any project
files needed by this task. Work autonomously without asking the user for confirmation. Preserve
unrelated user changes and do not modify Product Bible policy or external systems.

Use your normal engineering workflow: inspect the relevant code, form a concise implementation
approach, make the changes, and verify them. You may choose the exact route, hook, component, and
test structure that best matches the existing project conventions.

The implementation must provide a real, visible Inbox for tasks moved by recovery with explicit
`targetStartTime: null`. Keep ownership enforcement, React Query server state, existing Today
date filtering, and accessible loading/empty/error/retry states. The moved task must remain
visible and editable without restarting the app. Add focused backend, mobile, and cache
invalidation tests that prove the complete path.

Stay within the bounded scope of the task. Do not redesign the entire task system, introduce
unrelated product features, or change Product Bible policy. If an existing assumption blocks the
task, resolve it using the current codebase conventions and document the decision in your final
report.

Run the relevant API build and tests, mobile TypeScript checks and tests, and `git diff --check`.
Fix failures caused by this task before finishing. Report the files changed, verification
results, and any residual risks. Do not claim a manual device flow passed unless you actually ran
it.
