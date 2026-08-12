# Task 0012 — Actionable Now Card

**Status:** Completed
**Product basis:** PDR-001 and Future Screen Map
**Scope:** Expo mobile / Today

## Task Summary

Turn the existing passive `Now / Next` summary on Today into one calm, focused
action surface. The first increment must use only task states and actions that
already exist in the production contract.

## User Problem

Today currently names the current and next tasks but does not make the next
supported action obvious. A user must look elsewhere on the screen and infer
what to do.

## Product Context

- PDR-001 makes `Сейчас` more important than the full schedule.
- Future Screen Map requires one primary CTA rather than several equal choices.
- Product Constitution requires a visible next step, low cognitive load and no
  false certainty.

## Acceptance Criteria

1. Today shows one `Сейчас` card when a current or upcoming scheduled task exists.
2. A current task has one primary action, `Завершить`, backed by the existing
   completion mutation.
3. Editing the current plan remains available as a visually secondary action.
4. When no task is currently active, the nearest upcoming task is shown with
   one primary `Открыть задачу` action.
5. The card includes the task title, approximate duration and scheduled time.
6. Actions have accessibility roles and task-specific accessible labels.
7. The existing timeline, Recovery, quick add, day navigation and task form
   behavior remain unchanged.
8. Component tests cover current, upcoming and edit actions; the full mobile
   suite and TypeScript check pass.

## Out of Scope

- Adding an `in progress` task state or database migration.
- A pretend `Начать` action that has no persisted or session behavior.
- `Мне трудно начать`, AI decomposition, overload mode or Smart Planner.
- Focus timer, body doubling and public/private focus rooms.
- Navigation redesign, calendar-strip redesign or full Structured-like restyle.

## Risks and Mitigations

- **Risk:** the card claims that an upcoming task is happening now.
  **Mitigation:** label it `Ближайшее действие` and show its scheduled time.
- **Risk:** too many equal actions recreate choice overload.
  **Mitigation:** one filled primary CTA; editing is secondary and only appears
  for the current task.
- **Risk:** implementation silently invents a start/session state.
  **Mitigation:** restrict actions to completion and opening the task until a
  later product/engineering contract defines starting.

## Deliverables

- Reusable `NowCard` component.
- Today integration.
- Focused component tests.
- Verification evidence recorded in this task before completion.

## Verification Evidence

Verified on 2026-08-12 from repository root:

- `npm test --workspace=apps/mobile -- --runInBand` — **PASS**, 20 suites,
  264 tests.
- `./node_modules/.bin/tsc --noEmit -p apps/mobile/tsconfig.json` — **PASS**.
- `git diff --check` — **PASS**.

No API, database, migration, notification or release behavior changed. Device
and emulator visual smoke remain outside this bounded component increment.
