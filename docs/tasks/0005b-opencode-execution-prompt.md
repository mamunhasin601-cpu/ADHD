# OpenCode Task Prompt: Add Real Inbox Boundary Tests

Implement `docs/tasks/0005b-add-real-inbox-boundary-tests.md` in the current repository.

You may inspect the codebase and autonomously create or modify project files needed for this
test correction. Do not ask the user for confirmation for in-repository changes. Preserve
unrelated work, do not modify Product Bible policy, and do not touch external systems.

Use your normal engineering workflow and choose testing tools that fit the existing NestJS and
Expo/Jest stacks. Keep the working Inbox behavior intact unless a real HTTP or component test
exposes a defect. The important outcome is genuine boundary evidence: HTTP requests must pass
through Nest routing and validation, and mobile interaction tests must render the real
`InboxScreen`.

Run the task's verification commands, fix in-scope failures, and report changed files, exact
test counts, and residual limitations. Stop after Task 0005B; Task 0006 remains separate.
