# Task 0014 — Explicit Quick-Capture Destinations

**Status:** Completed
**Product basis:** Product Constitution, Future Screen Map, and PDR-001
**Scope:** Expo mobile / Today quick capture

## User Problem

The Today quick-capture sheet used one generic `Создать` action, so a user could
not tell whether the title would be left unscheduled, placed on the timeline, or
opened for further planning. That ambiguity adds a planning decision at the
moment Focus should calmly help the user get something out of their head.

## Product Basis

- The Future Screen Map defines `Мысли` as the user-facing place for capture
  without mandatory planning and the global `+` as the quick entry point.
- PDR-001 requires title-first quick creation and a timeline that makes the
  result of an action predictable.
- The Constitution protects user agency and calls for a clear next step without
  shame, pressure, or invented certainty.

## Acceptance Criteria

1. Global `+` capture requires only a non-blank title and explicitly offers
   `Сохранить в Мысли`; its existing create mutation receives the trimmed title
   and `startTime: null`.
2. Timeline capture displays its selected time and its primary action names that
   time; the create mutation receives the selected time's ISO value.
3. Timeline capture also offers `В Мысли`, which sends `startTime: null`.
4. `Подробнее` remains available and passes a trimmed `prefillTitle` plus the
   existing `prefillStartTime` when a timeline time was selected.
5. Blank and pending creation controls cannot submit, and pending state also
   prevents navigation to the full form.
6. Capture resets only after successful creation; existing paywall and generic
   error branches remain intact.
7. Relevant controls expose Russian accessibility labels, button roles, and
   disabled state.
8. No API, database, route, React Query key, notification, recovery, or
   technical `inbox` contract changes.

## Implementation Boundaries

The change is confined to the existing Today quick-capture modal and its focused
tests. It adds no duration picker, model, endpoint, migration, route rename,
planning behavior, or broader Today redesign.

## Files Changed

- `apps/mobile/app/(tabs)/today.tsx`
- `apps/mobile/tests/today-create-task.spec.tsx`
- `docs/tasks/0014-quick-capture-destinations.md`

## Verification Results

Verified on 2026-08-12 from the repository root after restoring the exact
lockfile dependencies with `npm ci --no-audit --no-fund`:

- `npm test --workspace=apps/mobile -- --runInBand` — **PASS**, 20 suites,
  270 tests.
- `npm test --workspace=apps/mobile -- --runInBand --runTestsByPath tests/today-create-task.spec.tsx`
  — **PASS**, 1 suite, 8 tests.
- `./node_modules/.bin/tsc --noEmit -p apps/mobile/tsconfig.json` — **PASS**.
- `git diff --check` — **PASS**.
- `git diff --check 90b6a01c5c8470381b603d61cbf4dcdc2c8b2e06 HEAD`
  — **PASS**.

## Residual Limitations

- Device/emulator visual and accessibility smoke testing was not performed.
- Verification is component, integration-test, and static-type based; no API,
  database, notification delivery, publication, or release operation was run.

## Honest Status

Task 0014 is **completed**: all acceptance criteria are implemented, the focused
suite and complete mobile suite pass, TypeScript passes, and both required diff
checks pass.
