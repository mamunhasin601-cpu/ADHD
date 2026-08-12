# Task 0011L Cleanup Follow-up: Close Disposable Database Evidence

**Status:** ready for autonomous execution  
**Source:** Product Review of Task 0011L

## Goal

Close the only remaining Task 0011L evidence gap by verifying and recording the cleanup state of the
isolated PostgreSQL container and anonymous volume used for the clean-database migration test.

## Problem

Task 0011L successfully records the migration and e2e evidence, but calls
`focus_postgres_clean_0011l` and its anonymous volume disposable without stating whether either
resource was removed. The execution prompt explicitly required cleanup status in ADR-009,
`IMPLEMENTATION_STATE_v2.md`, and `NEXT_STEPS_v2.md`.

## Authorization

Work autonomously. You may inspect Docker resources and remove only the exact disposable resources
created for Task 0011L. Do not ask for confirmation for in-scope actions.

## Requirements

- Inspect the exact container `focus_postgres_clean_0011l` before taking action.
- If it exists, inspect its mounts and capture the exact anonymous volume name before removing it.
- Capture the identity/state of the shared `focus_postgres` container and `adhd_postgres_data`
  volume before and after cleanup.
- Remove only `focus_postgres_clean_0011l` if it still exists.
- Remove its anonymous volume only after proving the volume is not used by any other container.
- If the disposable container or volume is already absent, record the commands and exact observed
  state. Do not invent cleanup evidence.
- Confirm that `focus_postgres`, `adhd_postgres_data`, and the shared `focus_db` remain available and
  were not reset or deleted.
- Update ADR-009, `docs/ai/IMPLEMENTATION_STATE_v2.md`, and `docs/ai/NEXT_STEPS_v2.md` with the exact
  cleanup commands and results.
- Preserve the successful Task 0011L migration and e2e evidence.
- Keep real-device smoke marked **NOT VERIFIED**.

## Acceptance Criteria

- The exact cleanup state of `focus_postgres_clean_0011l` is documented.
- The exact cleanup state of the associated anonymous volume is documented.
- No disposable Task 0011L container or identifiable unused anonymous volume remains.
- The shared PostgreSQL container, named volume, and database remain intact.
- Only the three permitted evidence documents are edited.
- `git diff --check -- docs/ADR docs/ai` passes.

## Safety Constraints

- Never run `docker compose down`, `docker compose down -v`, `prisma migrate reset`, `prisma db
  push`, or any broad container/volume prune command.
- Never remove `focus_postgres`, `focus_redis`, `adhd_postgres_data`, or any resource whose identity
  is ambiguous.
- Do not edit production source, tests, Prisma schema, migration SQL, Product Bible policy, package
  files, deployments, or git history.
- If the anonymous volume cannot be identified safely, leave it in place and document the exact
  blocker instead of guessing.

## Required Evidence

Finish with a concise evidence table containing:

- resource name/ID;
- pre-cleanup state;
- action taken;
- post-cleanup state;
- shared-resource preservation result;
- files changed;
- `git diff --check` result.

