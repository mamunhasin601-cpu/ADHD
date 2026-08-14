# Task 0018 — final invalidated-save hardening

## Race invariant

When canonical task props report `startedAt` or `completedAt`, NowCard first invalidates the active save generation, then releases the save duplicate guard and clears local save-pending state before closing difficult-start support and resetting its transient state. Any older save continuation remains scoped by mounted instance, task ID, and request generation, so its later resolution, rejection, or cleanup cannot mutate the canonical card.

The mounted-instance ref is explicitly restored to `true` in effect setup and set to `false` in cleanup, where save and start generations are invalidated. This is safe when React 18 development StrictMode replays effect setup after cleanup. The current React Native test renderer supports rendering under `React.StrictMode`; the regression verifies the flow remains usable there, although the renderer does not expose a direct assertion that development effect replay occurred.

## Changed files

- `apps/mobile/components/NowCard.tsx`
- `apps/mobile/components/NowCard.spec.tsx`
- `docs/tasks/TASK-0018-first-step-difficult-start-support.md`

## Verification evidence

Verified on 2026-08-14:

- focused NowCard: 1 suite / 25 tests passed with no warning output;
- focused start mutation with `--detectOpenHandles`: 1 / 5 passed with no open handles;
- full mobile: 27 / 368 passed;
- mobile `tsc --noEmit`: passed;
- `git diff --check`: passed.

The full mobile suite retains the established React Native Modal `act(...)` cleanup warnings from `today-create-task.spec.tsx`; the focused changed suite emits none. npm continues to report the existing unknown `http-proxy` configuration warning. No API, schema, migration, Task Form, or product-strategy behavior changed, so API and Prisma verification was not repeated. Migration application and device/emulator visual smoke remain unverified from the earlier Task 0018 work.
