# OpenCode Execution Prompt: Final Recovery Acceptance Remediation

Implement `docs/tasks/0007a-final-recovery-remediation.md` in the current repository.

You are authorized to autonomously inspect, create, and modify any in-project files required by
that task. Do not ask the user for confirmation for routine repository edits. Preserve unrelated
work and keep all changes within the task scope. Do not modify Product Bible policy, publish,
deploy, push, or change external systems.

Start with the confirmed findings in the task, then implement and test every correction. Keep the
real production Recovery flow, QueryClient integration tests, HTTP boundary tests, and conditional
transaction behavior. Do not replace integration coverage with direct helper tests or broad mocks.

Do not add `--forceExit`, suppress warnings, increase Jest timeouts, or claim an unavailable
PostgreSQL/Redis e2e or device smoke check passed. If infrastructure is unavailable, run the
command, capture the exact failure, and report it as not verified. Update engineering documents
only when their statements match the evidence. Product Bible files and policy must remain
unchanged.

Run every verification command listed in the task. Report changed files, exact test counts and
exit codes, documentation updates, unavailable checks, manual smoke status, and residual risks.
Stop after Task 0007A.
