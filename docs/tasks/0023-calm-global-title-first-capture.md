# Task 0023 — calm global title-first capture

**Status:** Completed
**Product basis:** Constitution, UX Principles, Product Experience Model,
Future Screen Map, PDR-001, and the Phase 1 roadmap
**Scope:** Expo mobile tab layout and existing Today timeline capture

## User problem and result

The floating capture action previously belonged to Today, so a person in
Thoughts, Focus, or Settings first had to navigate away from their current
context. The tab layout now owns one calm global action and one capture sheet.
Today no longer renders a second local action or owns duplicate modal state;
timeline slot gestures pass their canonical selection into the global owner.

## Behavior and boundaries

- A trimmed non-blank title remains the only required input. Global capture
  defaults explicitly to `Сохранить в Мысли`, sends `startTime: null`, and uses
  the shared `Не знаю` (`durationMinutes: null`) duration contract.
- Existing optional duration presets are shared with the full task experience.
  Failed requests retain the title and selection; success refreshes the inbox,
  clears authored state, and closes the sheet.
- A Today slot retains its exact instant, selected date key, time-labelled
  primary action, `В Мысли` escape, and full-form prefills.
- Non-Today details use the current profile-local canonical day. Missing or
  invalid profile timezones fall back to the device calendar day, never UTC.
- A synchronous submission latch ignores repeated gestures. Each submission
  captures a monotonic operation identity, authenticated owner, session
  generation, and immutable capture selection. Its continuation reads the
  current Zustand auth state directly after creation and around every awaited
  inbox or dated refresh before it may touch caches, UI, navigation, or errors.
  Owner/session changes, tab changes, superseding submissions, and provider
  unmount invalidate the operation. React 18 effect setup restores mounted
  ownership safely after development effect replay.
- Existing task DTOs, API, Prisma model, reminder channel policy, paywall route,
  and notification behavior are unchanged. In particular, unscheduled capture
  has no reminder because it has no start time.

## Accessibility

The global action is a single Russian-labelled button placed above the tab bar.
It exposes disabled and busy state. Capture destinations and duration choices
retain explicit roles, labels, selected state, disabled state, and busy state;
only the actual save destination is styled as the sheet's primary action.

## Files changed

- `apps/mobile/components/GlobalCapture.tsx`
- `apps/mobile/components/GlobalCapture.spec.tsx`
- `apps/mobile/app/(tabs)/_layout.tsx`
- `apps/mobile/app/(tabs)/today.tsx`
- `apps/mobile/tests/today-create-task.spec.tsx`
- `Product-Bible/09-Roadmap/Feature-Roadmap.md`
- `docs/tasks/0023-calm-global-title-first-capture.md`

## Verification evidence

- Focused global and Today capture tests: **2 suites, 33 tests passed**.
- Complete mobile Jest suite: **35 suites, 452 tests passed**.
- Mobile TypeScript `tsc --noEmit`: passed.
- `git diff --check`: passed.

The complete suite retains the pre-existing React Native `Modal` test cleanup
`act(...)` warning. npm also reports its existing `http-proxy` configuration
deprecation warning. No API code changed, so API tests were not required.

## Residual limitations

Android runtime and device/emulator accessibility behavior are **NOT VERIFIED**.
Validation is deterministic component/integration testing and static typing;
no emulator or physical device was used. No runtime, notification delivery,
database, or release evidence is claimed.
