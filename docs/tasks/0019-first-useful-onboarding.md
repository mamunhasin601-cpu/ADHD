# Task 0019 — Deliver the first useful onboarding moment

**Status: Completed**

## User problem and product basis

The former onboarding asked a new user to interpret an optional clock field,
silently invented a 30-minute duration, and delayed useful action behind an
educational feature tour. The replacement follows the Constitution's
title-first, explicit-destination, honest-unknown, canonical-state, and
first-useful-moment rules; Product Vision and User Bible guidance on reducing
cognitive load; Future Screen Map sections 0.1–0.4; Product Experience Model
sections 1–2; PDR-001; and the contracts completed in Tasks 0014, 0015, 0017,
and 0018.

## Exact behavior and payload contract

The welcome says only that Focus exposes one available next action and that a
plan need not be perfect. `Продолжить` opens a single title field;
`Пока пропустить` completes onboarding without task creation. There is no time,
duration, recurrence, color, first-step, subtask, personalization, or tour UI.

`Добавить на сейчас` trims the nonblank title, captures `new Date()` exactly
once for the owned submission, and calls the existing task mutation with only:

```ts
{
  title: trimmedTitle,
  startTime: capturedNow.toISOString(),
  durationMinutes: null,
}
```

It does not send `startedAt`, `completedAt`, `firstStep`, or an invented
duration. Scheduling does not start the task. After the canonical Task returns,
onboarding patches `/users/me` with `{ hasCompletedOnboarding: true }`, passes
the exact canonical returned User to `setUser`, and relies on the existing auth
routing guard to enter Today. Today's existing current-task rules and Now Card
then expose `Начать` and `Мне трудно начать` for the scheduled unknown-duration
task.

## Failure and concurrency invariants

- A synchronous ref guard owns create, keyboard submit, completion, and skip;
  rapid gestures cannot issue duplicate task or profile requests.
- Pending controls expose disabled and busy accessibility state.
- Create failure retains the exact input, does not patch the profile, and shows
  a calm inline retry.
- Once creation succeeds, the canonical Task remains in component state. If
  profile completion fails, the UI confirms the save and retries only the
  profile patch; it never recreates the task.
- Skip changes local auth state only after a successful canonical profile
  response and remains retryable after failure.
- Operation identity and mounted-state guards prevent late settlement or
  cleanup from updating stale UI or releasing a newer operation guard.
- Every mount-effect setup restores the mounted marker. This makes lifecycle
  ownership safe when React 18 development StrictMode replays setup after its
  diagnostic cleanup, while cleanup still invalidates the operation generation
  before an older async flow can release a newer guard.

## Accessibility behavior

The safe-area surface contains a keyboard-avoiding, scrollable layout. The
title has a visible label and explicit accessibility label. Pressables have
button roles plus disabled/busy state; keyboard submission uses the same owned
flow as the primary button. Inline errors use the alert role and calm,
non-blaming language. Skip and retry remain available without discarding the
entered intention.

## Changed files

- `apps/mobile/app/onboarding.tsx`
- `apps/mobile/tests/onboarding.spec.tsx`
- `apps/mobile/tests/today-start-task.spec.tsx`
- `docs/tasks/0019-first-useful-onboarding.md`
- `Product-Bible/09-Roadmap/Feature-Roadmap.md`

## Validation evidence

- Focused onboarding: 1 suite, 13 tests passed, including create-now and skip
  rendered under `React.StrictMode`; each task/profile operation and canonical
  `setUser` handoff occurs exactly once.
- Auth routing, root routing, Today capture, task form, and inbox regression:
  5 suites, 65 tests passed.
- Follow-up affected auth-routing validation: 2 suites, 29 tests passed.
- Today explicit start/difficult-start and onboarding handoff boundary with
  open-handle detection: 1 suite, 9 tests passed.
- Full mobile suite: 27 suites, 366 tests passed.
- Mobile TypeScript (`npx tsc --noEmit -p apps/mobile/tsconfig.json`) passed.
- `git diff --check`, diff-stat review, and complete-diff review passed before
  each Task 0019 commit.

## Warnings and residual limitations

- The affected Today capture test emits its pre-existing React Native Modal
  cleanup warnings about updates not wrapped in `act`; the suite passes and the
  warnings are not hidden or relabelled.
- npm reports its existing unknown `http-proxy` environment-config warning.
- React Native Testing Library's renderer accepts a `React.StrictMode` wrapper
  and proves the live create and skip invariants, but it does not directly
  expose React DOM's development-only effect-replay sequence. Production setup
  is nevertheless replay-safe because every setup explicitly restores the
  mounted marker.
- The timezone boundary uses `2026-08-15T12:30:00.000Z`, which is UTC date
  `2026-08-15` but profile date `2026-08-16` in `Pacific/Auckland`. The Today
  integration invokes its real canonical-date and current-task helpers, proves
  the query selects `2026-08-16`, includes the created unknown-duration task,
  and renders it unstarted in the real Now Card with `Начать` and
  `Мне трудно начать`.
- Task 0011 notification permission, registration, revocation, banner, and
  reminder behavior is intentionally unchanged. The existing permission prompt
  may still appear before the user sees the Now Card; its timing remains a
  separate product-review item and is not claimed as solved here.
- No API, Prisma schema, migration, shared contract, routine, AI, focus-session,
  overload-mode, theme, or monetization behavior changed.
