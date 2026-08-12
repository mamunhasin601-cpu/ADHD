# Task 0003: Complete Guilt-Free Recovery Acceptance

**Status:** superseded as a single execution unit; use Tasks 0004-0007 in order  
**Owner:** Claude Code, Lead Software Engineer  
**Source packages:** `docs/tasks/0001-guilt-free-recovery.md`, `docs/tasks/0002-implement-guilt-free-recovery.md`  
**Architecture decision:** `docs/ADR/ADR-008-overdue-task-recovery.md`  
**Review result:** rejected; implementation is not yet acceptance-ready

> Do not execute this entire package in one Claude Code run. It exceeded a practical execution
> window and caused a plan-only termination. Execute `0004`, `0005`, `0006`, and `0007` as four
> separate runs. Together they implement this package without reducing its requirements.

## Mandatory execution directive

This is an implementation command, not a request for review, analysis, a proposal, or a
plan-only response.

You must edit the repository in the same run in which you read this task. Write a short plan,
then immediately continue into implementation without waiting for a reply. A response that only
describes intended changes, asks whether to proceed, or reports that no files were changed does
not satisfy this task.

The Product Owner and Product Architect have already approved every product behavior, UX flow,
public API correction, architecture adjustment, authentication/OAuth build correction, and
documentation update explicitly listed in this task and in packages 0001/0002.

This task context is the approval required by **STEP 6 - Approval** in
`Product-Bible/AI/Claude-Code.md`. Do not request that approval again.

The **Stop Conditions** in `Product-Bible/AI/Claude-Code.md` do not require a stop for the UX,
user-flow, API, architecture, or auth corrections explicitly specified here: those decisions
have already been made by Codex and approved by the Product Owner. Stop only if you discover a
new decision outside the written contract.

Do not return control after planning. Continue through file edits, tests, documentation, and
verification autonomously.

## Execution authority

You are explicitly authorized to complete this task autonomously inside the project workspace.

- Create, modify, move, or remove in-scope project files when required.
- Modify production source code, tests, fixtures, configuration, API contracts, mobile UI,
  architecture records, and engineering documentation.
- Do not ask for permission or wait for approval before making an in-scope file change.
- Public API corrections described by this task are pre-approved because they restore the
  already-approved recovery contract.
- Make the smallest coherent changes required to satisfy the contract and quality gates.
- Preserve unrelated user changes in the working tree. Do not reset, revert, or overwrite
  unrelated work.
- Do not modify `Product-Bible/**`; verify implementation behavior against it instead.
- Ask for a Product Owner decision only if completion would require genuinely new behavior not
  already defined by this task, packages 0001/0002, or ADR-008. Do not use this exception for
  implementation choices that can be resolved from the existing codebase and handbook.

This authority applies only to the repository/project workspace. Do not publish, deploy, push,
open a pull request, change external services, or perform destructive operations outside the
project.

## Goal

Correct the rejected Guilt-Free Recovery implementation so every acceptance criterion in
package 0001 is demonstrably satisfied, all required engineering documentation is synchronized,
and project quality gates pass.

Do not add unrelated features. Do not declare the capability complete until verification
evidence exists.

## Required reading

Before changing files, read:

1. `Product-Bible/AI/Claude-Code.md`;
2. `docs/tasks/0001-guilt-free-recovery.md`;
3. `docs/tasks/0002-implement-guilt-free-recovery.md`;
4. `docs/ADR/ADR-008-overdue-task-recovery.md`;
5. Relevant sections of `docs/Engineering-Handbook-v5.md`;
6. Current task, notification, plan, auth/OAuth, mobile Today, and intended Inbox code;
7. Existing unit, integration, e2e, and mobile test infrastructure.

## Rejected findings to correct

### 1. Make Inbox a real, visible destination

The current dated task query excludes `startTime = null`, there is no active Inbox query or
screen, and invalidating `['tasks', 'inbox']` has no consumer. A recovery task moved to Inbox
therefore disappears from the usable UI.

Required correction:

- Implement the smallest complete Inbox read and visible access path consistent with the
  existing product and navigation model.
- Reuse the existing task API where practical. If an additive query parameter or endpoint is
  needed, define, validate, test, and document it.
- Ensure an unscheduled root task is visible in Inbox immediately after recovery success.
- Keep exact-day filtering behavior intact for the timeline.
- Ensure Today, Inbox, and recovery cache keys represent real queries and are invalidated
  consistently.
- Test that a task moved to Inbox remains accessible and editable instead of disappearing.

This is completion of an already-approved destination, not authorization for a broader Inbox
redesign.

### 2. Require an explicit destination value

The current DTO allows `targetStartTime` to be omitted, and the service treats `undefined` as
`null`, producing an implicit move to Inbox.

Required correction:

- Require every item to contain `targetStartTime` explicitly.
- Accept only a valid ISO-8601 instant or explicit JSON `null`.
- Reject a missing property, `undefined`, malformed value, duplicate task ID, empty batch, and
  oversized batch before any write.
- Never convert a missing or invalid destination into Inbox.
- Add DTO/controller-level tests proving the HTTP contract, not only direct service tests.

### 3. Correct destination and timezone semantics

The current mobile flow offers only Inbox or a hard-coded device-local 09:00. It does not offer
the required future destination, can schedule into the past after 09:00, and ignores the
server-returned user timezone.

Required correction:

- Remove the hard-coded 09:00 mapping.
- Let the user explicitly choose a valid Today/future date and time for every selected task, or
  explicitly choose Inbox.
- Show the exact resulting destination before confirmation.
- Disable confirmation until every selected task has a valid explicit destination.
- Use the user's stored IANA timezone for day meaning and displayed destination semantics.
- Do not use `toISOString().slice(0, 10)` where it can convert a local calendar date into a
  different date. Centralize a tested date mapper.
- Handle device-timezone and profile-timezone differences deterministically.
- Reject a destination that is already in the past at confirmation time.
- Preserve neutral language and do not auto-distribute tasks across time slots.

Reuse existing date/time controls and design conventions where possible.

### 4. Surface partial reminder synchronization

The backend returns `reminderSyncStatus: 'partial'`, but the mobile success path ignores it.

Required correction:

- Treat the task reschedule as successful after the database commit.
- When reminder synchronization is partial, show a neutral, actionable message explaining that
  tasks were moved but some reminders could not be updated.
- Do not present the entire task mutation as failed.
- Preserve retry/reconciliation information without exposing task titles or sensitive data.
- Add mobile tests for both `ok` and `partial` success responses.

### 5. Close the stale-state race

The current service validates tasks before opening the write transaction. Another update can
complete or reschedule a task between validation and write.

Required correction:

- Make ownership, overdue/stale validation, and writes concurrency-safe within the transaction,
  or use conditional writes whose affected-row count proves all invariants still hold.
- Preserve all-or-nothing batch behavior.
- Do not overwrite a concurrent completion or reschedule.
- Keep reminder synchronization after commit.
- Add an integration-level concurrency/stale-state test that would fail with the previous
  read-before-transaction implementation.

### 6. Complete accessibility requirements

Required correction:

- Provide at least 44x44 effective touch targets for checkboxes and destination controls.
- Preserve screen-reader roles, labels, selected/disabled state, modal semantics, and readable
  destination text.
- Verify long task titles and localized text do not overlap or make controls inaccessible.
- Add focused component assertions where supported by the current mobile test stack.

### 7. Restore project quality gates

The API build and e2e suite currently fail on OAuth TypeScript errors. Mobile has no recovery
tests.

Required correction:

- Fix the four current OAuth TypeScript errors with the smallest behavior-preserving changes:
  private `generateTokens` access and the invalid Prisma `OR` array type.
- Preserve existing OAuth behavior and add/update tests if visibility or query construction
  changes.
- Make API build and API e2e execute successfully.
- Add recovery controller/integration/e2e coverage for authentication, DTO validation,
  ownership, atomic mixed batches, Inbox, future destination, stale state, and reminder partial
  success.
- Add mobile tests for banner visibility, selection, explicit destination, preview, cancel,
  confirm, loading, failure/retry, partial reminder status, cache invalidation, and no mutation on
  open.
- Preserve and run existing task CRUD, toggle, exact-day, ownership, and notification tests.
- Run existing lint gates. If the repository has no lint configuration, do not invent broad
  unrelated formatting work; document that fact accurately in the completion report.

## Documentation corrections

Do not mark this capability complete until all mandatory checks pass.

- Expand `docs/API.md` with method, authentication, query/body/response DTOs, statuses, error
  cases, ownership behavior, explicit-null semantics, and cache implications.
- Update `docs/Backend.md` with recovery validation, transaction, and reminder-side-effect flow.
- Update `docs/Architecture.md` with the vertical slice and Inbox/recovery data flow.
- Update `docs/Engineering-Handbook-v5.md` sections 6, 8, and 9 with the implemented facts and
  invariants required by package 0001.
- Update ADR-008 so its status and implementation notes match reality. Preserve the corrected
  Free-tier limit of 50 unless the actual shared contract changes.
- Correct `docs/ai/IMPLEMENTATION_STATE_v2.md` and `docs/ai/NEXT_STEPS_v2.md`:
  remove premature completion claims while work is incomplete, report the real test count, and
  mark the capability complete only after final verification.
- Do not edit Product Constitution, Product Vision, User Bible, or other Product Bible policy.

## Product constraints

The completed flow must remain consistent with:

- Product Vision: recovery reconnects the user with what is possible next; it does not repair
  the past or demand an ideal day.
- Product Constitution Articles 11, 15, and 21: return is mandatory, the next step is visible,
  and rescheduling is a normal user-controlled action.
- User Bible section 2.7: a missed task is a practical planning choice, not a moral event.

Therefore:

- no shame, debt, streak, punishment, or forced explanation;
- no silent destination, imposed priority, or automatic make-up schedule;
- no disappearing task after an accepted action;
- no claim that a reminder is reliable when synchronization is incomplete.

## Mandatory verification

Run and report the exact commands and results for:

1. API build/typecheck;
2. API unit tests;
3. API integration/e2e tests;
4. Mobile TypeScript check;
5. Mobile recovery/component/hook tests;
6. Existing lint commands, if configured;
7. `git diff --check` for files changed by this task.

Complete a manual authenticated smoke flow on an emulator/device when the environment supports
it:

1. Create tasks scheduled before the current local day.
2. Open Today and verify the recovery entry.
3. Open and cancel; verify no write.
4. Move one task to a future time and one task to Inbox.
5. Verify Today, Inbox, and recovery state without restarting.
6. Verify retry behavior and partial reminder-sync messaging.
7. Repeat the same request and verify no duplicate task or reminder effect.

If the environment cannot run the manual smoke flow, state that clearly and do not represent it
as passed.

## Definition of done

This task is complete only when:

- every acceptance criterion in package 0001 passes with evidence;
- no missing destination can silently become Inbox;
- Inbox is visible and usable after recovery;
- explicit Today/future scheduling is timezone-correct;
- partial reminder synchronization is visible without undoing the task update;
- stale validation is concurrency-safe and atomic;
- accessibility requirements are met;
- API build, unit tests, e2e tests, mobile typecheck, and mobile tests pass;
- required API, Backend, Architecture, Engineering Handbook, ADR, and implementation-state
  documents are synchronized;
- no Product Bible policy was changed;
- the completion report contains no unsupported completion or test-count claims.

## Completion report

Report:

- files created, changed, moved, or removed;
- behavior corrected for each rejected finding;
- acceptance-criteria evidence;
- exact verification commands and outputs summarized accurately;
- documentation and ADR updates;
- manual smoke result;
- remaining risks or unavailable checks.

Do not stop after writing a plan. Implement, test, document, and verify the complete corrective
package autonomously within the project.
