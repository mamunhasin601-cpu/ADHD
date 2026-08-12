# Task 0013 — Thoughts Language Boundary

**Status:** Completed
**Product basis:** Future Screen Map, section 5
**Scope:** Expo mobile user-facing copy

## Task Summary

Align the existing unscheduled-task surface with the approved Focus zone
`Мысли`. Keep the technical Inbox route, API parameter, React Query keys and
recovery destination contract unchanged.

## User Problem

The English label `Inbox` describes an implementation pattern rather than the
user's need. Focus promises a calm place to put something down without deciding
when it belongs in the day.

## Acceptance Criteria

1. Bottom navigation and the unscheduled-item screen use `Мысли`.
2. The screen explains its purpose as getting something out of the user's head,
   without requiring planning.
3. Loading, empty and error states use the same user-facing language.
4. Onboarding explains that an item without time goes to `Мысли`.
5. Recovery and Today links name the same destination consistently.
6. Technical identifiers (`inbox` route, query key, DTO values and test IDs)
   remain unchanged to avoid an unnecessary compatibility migration.
7. Updated UI tests and the full mobile suite pass.

## Out of Scope

- A new Thought database model or API endpoint.
- Renaming routes, cache keys or recovery payload values.
- Inbox-zero mechanics, mandatory triage, bulk cleanup or counters.
- A new global capture composer.

## Risks

- User copy and internal terminology can diverge. This is intentional at the UI
  boundary and must be documented in code/task context.
- Calling every unscheduled task a thought may become limiting later. The
  current copy uses `запись` inside the list while the zone remains `Мысли`.

## Deliverables

- Consistent mobile copy in navigation, Today, onboarding, recovery and the
  unscheduled-item screen.
- Updated component tests.
- Verification evidence before completion.

## Verification Evidence

Verified on 2026-08-12 from repository root:

- `npm test --workspace=apps/mobile -- --runInBand` — **PASS**, 20 suites,
  264 tests.
- `./node_modules/.bin/tsc --noEmit -p apps/mobile/tsconfig.json` — **PASS**.
- `git diff --check` — **PASS**.

The technical Inbox contract was not renamed. No API, database, cache-key,
notification or migration behavior changed.
