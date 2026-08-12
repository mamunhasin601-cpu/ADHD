# OpenCode Execution Prompt: Task 0010

Execute `docs/tasks/0010-complete-recovery-partial-observability.md` now.

This is an implementation task. Read the task completely, edit the repository, run its
verification commands, and report exact results. Do not respond with a plan or review only.

You are authorized to autonomously create and modify any files inside this project required by the
task. Do not ask the user for permission or confirmation for routine in-project changes. Preserve
unrelated work. Do not publish, deploy, push, commit, modify external systems, or change Product
Bible policy.

The required fix is narrow: make the partial Recovery reminder-sync log explicitly include
`reminderSyncStatus=partial`, operation counts, and numeric `latencyMs`, while retaining the
privacy-safe exclusions and all existing response/transaction behavior. Add regression assertions
for both required and forbidden fields, update only conflicting current documentation, run all
available checks, report unavailable infrastructure honestly, and stop after completion.

A response without actual file modifications is a failed execution.
