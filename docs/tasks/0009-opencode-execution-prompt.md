# OpenCode Execution Prompt: Task 0009

Execute `docs/tasks/0009-close-recovery-observability-and-docs.md` now.

This is an implementation task, not a review or planning exercise. Read the task completely, then
make every required repository change and run every available verification command.

You are explicitly authorized to autonomously create and modify any files inside this project that
are needed to complete Task 0009. Do not ask the user for permission, confirmation, or approval for
routine in-project edits, new test files, documentation updates, or command execution. Preserve
unrelated work. Do not publish, deploy, push, commit, modify external systems, or change Product
Bible policy.

Required outcomes:

1. Recovery production logs use one privacy-safe field contract: outcome, counts, latency,
   reminder status where applicable, and failure class where applicable.
2. Recovery logs contain no timezone, local-day boundary, user/task identifiers, titles, tokens,
   destinations, or request payloads.
3. Focused logger tests prove both the allowed fields and forbidden-field absence.
4. The duplicate post-0007A verification table is removed from `docs/ai/NEXT_STEPS_v2.md`.
5. Engineering Handbook sections 6 and 9 and ADR-008 match the implemented contract.
6. All available focused and full verification commands pass, with exact results reported.

Do not merely describe intended edits. A response without actual file modifications is a failed
execution. If a verification command fails, diagnose it, fix failures caused by Task 0009 within
the repository, and rerun the relevant checks. Report unavailable infrastructure-dependent checks
honestly as not verified. Then provide the completion report required by the task and stop.
