# Task 0005A: Complete Inbox Acceptance

**Status:** ready  
**Context:** correction of the Product Review findings for Task 0005  
**Next:** Task 0006 after this task is accepted

## Goal

Complete the Inbox implementation so its mutations use the real Inbox cache, the mobile project
type-checks, and automated tests exercise the actual HTTP, hook, cache, and screen behavior.

This task corrects the existing Inbox slice. It does not redesign Inbox or add new product
features.

## Confirmed defects

1. `InboxScreen` calls `useToggleTask(new Date(0))`. That hook mutates and invalidates
   `['tasks', '1970-01-01']`, while the screen reads `['tasks', 'inbox']`. A long-press toggle can
   update the server without updating the visible Inbox.
2. Mobile TypeScript fails in `today.tsx` because `recoveryData` is possibly undefined inside
   the recovery confirmation callback.
3. Inbox backend tests are service unit tests only. No HTTP-level test proves query-string
   transformation, validation, authenticated identity delegation, or response behavior for
   `GET /tasks?inbox=true`.
4. `apps/mobile/lib/api/inbox.spec.ts` duplicates production logic in local functions. It does
   not import and exercise the real hooks, query client behavior, or `InboxScreen`.

## Required behavior

### Inbox mutation and cache

- Remove the epoch-date sentinel from `InboxScreen`.
- Make completion toggle behavior operate on the real `['tasks', 'inbox']` cache.
- Provide correct optimistic state, rollback on failure, and invalidation/refetch after settle,
  consistent with the existing task mutation conventions.
- Keep other dated Today task toggles working with their existing cache keys.
- Opening and editing an Inbox task must continue to refresh the Inbox query.
- Recovery with `targetStartTime: null` must continue to invalidate Today, recovery, and Inbox.

Choose the smallest implementation that fits the current hook architecture. A dedicated Inbox
toggle hook or a reusable cache-target option are both acceptable if the behavior and types are
clear.

### Mobile TypeScript

- Resolve the `recoveryData is possibly undefined` error without restoring device-local date
  arithmetic or broadening this task into Task 0006.
- Preserve the current recovery request behavior until Task 0006 replaces the destination UX.
- The complete mobile TypeScript check must pass.

### Real automated tests

Add tests that execute production code instead of copied helper logic.

Backend HTTP coverage must prove:

- `GET /tasks?inbox=true` accepts the real query-string form and reaches `TasksService.findAll`
  with the authenticated user's ID and `inbox: true`;
- invalid Inbox query values are rejected by the configured validation behavior;
- caller-supplied identity cannot replace the authenticated identity;
- the response contains only the service result and preserves the existing route contract.

Mobile coverage must prove using the real hooks/components where practical:

- `useInboxTasks` uses `['tasks', 'inbox']` and requests `/tasks` with Inbox parameters;
- Inbox toggle updates the visible Inbox cache, rolls back on failure, and invalidates the same
  key after settle;
- recovery-to-Inbox success invalidates the real Inbox key;
- `InboxScreen` has loading, empty, populated, error, and retry behavior;
- selecting a task opens the existing task form;
- the existing long-press completion action does not leave stale UI.

Use the current test stack. If real hook/component testing requires a narrowly scoped test
dependency or Jest setup change, add it to the correct workspace and keep the configuration
minimal. Remove or rewrite copied-logic tests that provide no regression protection.

## Engineering constraints

- Preserve JWT-derived ownership and the existing root-task Inbox filter.
- Keep server state in React Query; do not add Inbox task data to Zustand.
- Preserve unrelated user changes.
- Do not modify Product Bible policy.
- Do not perform Task 0006's destination-picker, DST, or reminder partial-success redesign here.

## Verification

Run and report:

```powershell
npm.cmd run build:api
npm.cmd run test:api -- --runInBand
npx.cmd tsc --noEmit -p apps/mobile/tsconfig.json
npm.cmd run test --workspace=apps/mobile -- --runInBand
git diff --check -- apps/api/src/tasks apps/mobile/app apps/mobile/lib apps/mobile/components
```

If a command fails because of this task, fix it before finishing. Pre-existing warnings outside
the listed task paths may be reported separately, but they do not replace the scoped check.

## Completion evidence

Report the files changed, the real tests added or replaced, exact command results, and any
environment limitation. Do not call direct local-function simulations integration tests. Do not
claim a device smoke flow passed unless it was actually run.
