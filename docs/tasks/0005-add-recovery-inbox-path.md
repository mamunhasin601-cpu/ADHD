# Task 0005: Add the Recovery Inbox Path

**Status:** ready after Task 0004  
**Depends on:** `0004-fix-recovery-backend-safety.md`  
**Next task:** `0006-fix-recovery-mobile-flow.md`

## Execution directive

Implement this task now. Write a short plan and then edit files immediately. Do not ask for
permission or wait for approval. The Inbox behavior below is already approved by packages 0001
and 0002 and by the Product Owner/Product Architect.

You may create and modify backend, mobile, test, navigation, shared-contract, and engineering
documentation files inside the repository. Preserve unrelated changes. Do not modify Product
Bible policy or external systems.

Read only the current task API/service, mobile tabs/task hooks/task form, relevant tests, and the
Inbox requirements in package 0001. Within the first five tool calls after reading this task,
make the first source edit.

## Goal

Make explicit recovery destination `null` lead to a real, visible, usable Inbox instead of
making the task disappear.

This task completes the already-approved Inbox destination. It does not authorize a broad Inbox
redesign or new planning features.

## Backend requirements

- Provide a typed authenticated read for unscheduled root tasks owned by the caller.
- Reuse `GET /tasks` with an additive validated query parameter or add a static Inbox route,
  whichever best matches existing conventions.
- Return tasks where `startTime IS NULL`; define completed-task behavior consistently with the
  current intended Inbox experience.
- Preserve exact-day filtering for dated Today requests.
- Keep ownership enforced by authenticated user ID; accept no caller-supplied `userId`.
- Register any static route before `GET /tasks/:id`.
- Add service and HTTP-level tests for ownership, filtering, empty state, and route validation.

## Mobile requirements

- Add a real `useInboxTasks` query using the same cache key invalidated by recovery success.
- Add the smallest visible Inbox access path consistent with the existing Expo Router tab model.
- Show unscheduled tasks and a calm empty state.
- Let the user open an Inbox task in the existing task form so it can be scheduled or edited.
- Reuse existing task toggle/edit patterns where appropriate.
- After recovery moves a task to Inbox, Today, Inbox, and recovery data must agree without an
  application restart.
- Do not store Inbox server data in Zustand.
- Keep touch targets, labels, loading, error, and retry states accessible.

## Tests

Add focused tests for:

- backend Inbox filtering and ownership;
- Inbox API/hook cache key;
- Inbox loading, empty, error/retry, and task-visible states;
- recovery success with `targetStartTime: null` invalidating and refetching the real Inbox query;
- the moved task remaining accessible/editable.

Use the current test stack. Add a narrowly scoped test dependency only if component testing
cannot otherwise satisfy the acceptance criteria, and record why.

## Required verification

Run API build/unit/e2e, mobile TypeScript, focused mobile tests, and `git diff --check` for this
task's files. Fix in-scope failures before finishing.

## Definition of done

- Inbox is a visible application surface backed by a real query.
- Moving a recovery task to Inbox never makes it inaccessible.
- Exact-day Today filtering is unchanged.
- Cache invalidation targets real Today, Inbox, and recovery queries.
- Backend and mobile tests prove the complete path.
- Source and test files are changed in this run.

Report changed files and verification results. Then stop; Task 0006 handles recovery scheduling
and reminder UX.
