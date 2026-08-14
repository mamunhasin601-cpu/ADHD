# Task 0018 — persisted first step and difficult-start support

**Status:** Completed

## User problem and accepted meaning

An explicit start exists, but a task can still feel too large to enter. Focus now lets the user write an optional `firstStep`: one short, physically observable entry action. It is not a subtask, separate task, completion state, timer, session, or generated suggestion, and saving it is planning rather than evidence that action began.

## Persistence and validation

`Task.firstStep` is nullable. The forward migration adds a nullable text column, so existing rows remain `null`. Create and generic update accept a string or `null`; the production ValidationPipe trims strings, normalizes blank input to `null`, rejects other values, and enforces 240 characters. `startedAt` remains absent from writable DTOs.

## Task Form and difficult-start states

The Task Form exposes the optional field in create and edit flows and sends cleared input as `null`; failed saves retain the entered value. On an incomplete, unstarted Today Now Card, `Начать` stays visually primary and `Мне трудно начать` opens an owned, keyboard-safe modal. With no step, the modal explains the meaning, disables blank submission, and saves without starting. With a persisted step, it shows the exact text, offers explicit `Начать с этого шага` through the existing start mutation, and allows editing or closing.

Save and start submissions have disabled/busy states and synchronous duplicate guards. Save errors retain input. Start errors retain the step and surface for retry. Component state resets when the task changes, and Today already suppresses the live Now Card on other dates. Labels, roles, alerts, close behavior, scalable text, and non-color status cues are retained.

## Invariants and non-goals

A first-step-only update does not write schedule, duration, recurrence, completion, or start fields and uses existing ownership and reminder synchronization behavior. Starting, completion, and reopening do not write `firstStep`; the canonical server start response remains authoritative. This slice adds no AI, decomposition, timer, pause/resume, focus session, body doubling, global active-task rule, energy score, automatic rescheduling, analytics, monetization, or redesign.

## Changed files

Exact changed files:

- `Product-Bible/09-Roadmap/Feature-Roadmap.md`
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260814010000_add_task_first_step/migration.sql`
- `apps/api/src/tasks/dto/create-task.dto.ts`
- `apps/api/src/tasks/dto/create-task.dto.spec.ts`
- `apps/api/src/tasks/tasks.service.ts`
- `apps/api/src/tasks/tasks.service.spec.ts`
- `apps/api/src/tasks/task-first-step-migration.spec.ts`
- `packages/shared-types/src/index.ts`
- `apps/mobile/app/(tabs)/today.tsx`
- `apps/mobile/app/task-form.tsx`
- `apps/mobile/components/NowCard.tsx`
- `apps/mobile/components/NowCard.spec.tsx`
- `apps/mobile/components/RecoveryBanner.spec.tsx`
- `apps/mobile/components/RecoverySection.spec.tsx`
- `apps/mobile/lib/api/inbox.spec.ts`
- `apps/mobile/lib/current-task.spec.ts`
- `apps/mobile/lib/local-notifications.spec.ts`
- `apps/mobile/lib/timeline-layout.spec.ts`
- `apps/mobile/tests/_layout.spec.tsx`
- `apps/mobile/tests/inbox.spec.tsx`
- `apps/mobile/tests/task-form.spec.tsx`
- `apps/mobile/tests/today-create-task.spec.tsx`
- `apps/mobile/tests/today-start-task.spec.tsx`
- `docs/tasks/0018-difficult-start-first-step.md`

## Verification evidence and limitations

Verified on 2026-08-14: focused API suites (3 suites / 45 tests), focused mobile suites (4 / 36), full API (18 / 258), full mobile (27 / 353), both TypeScript checks, Prisma validate/generate, focused start mutation with `--detectOpenHandles` (1 / 5), and `git diff --check` passed. The full mobile run retains established React Native Modal `act(...)` warnings in `today-create-task.spec.tsx`; focused Task 0018 suites and the open-handle run were clean. npm also reports the existing unknown `http-proxy` config warning. No disposable database was available: the SQL was reviewed statically and migration application remains unverified.

## Review follow-up — difficult-start hardening

The PR #7 follow-up closes difficult-start support only when canonical task props report `startedAt` or `completedAt`, while a rejected start keeps the persisted step and surface available. Modal start and save paths now have independent synchronous guards plus immediate local busy states; the existing Today guard remains defense in depth. Saving disables conflicting actions but not Close, retains the exact draft on failure, clears its scoped error on edit/retry/success, and displays the exact canonical server step.

The modal now uses platform-aware `KeyboardAvoidingView`, a bounded `ScrollView` with `keyboardShouldPersistTaps="handled"`, and a bottom `SafeAreaView`. Task switches reset modal/draft/error state; Today integration coverage verifies date changes unmount live support and returning uses canonical task data. No emulator or physical-device visual smoke was available, so keyboard and scaled-text behavior is structurally tested but device visual smoke remains unverified.

Follow-up files are:

- `apps/api/src/tasks/dto/update-task.dto.spec.ts`
- `apps/api/src/tasks/tasks.service.spec.ts`
- `apps/mobile/components/NowCard.tsx`
- `apps/mobile/components/NowCard.spec.tsx`
- `apps/mobile/tests/today-start-task.spec.tsx`
- `docs/tasks/0018-difficult-start-first-step.md`

Verification on 2026-08-14: focused API DTO/service/start/migration tests passed (6 suites / 65 tests); focused NowCard and real Today integration tests passed (2 / 26); Task Form passed (1 / 13); the focused start mutation `--detectOpenHandles` run passed cleanly (1 / 5). Full API passed (19 / 269) and full mobile passed (27 / 361). Both TypeScript checks and Prisma validate/generate passed, as did `git diff --check`. The complete mobile suite still emits the established React Native Modal `act(...)` cleanup warnings from `today-create-task.spec.tsx`; the new focused suites emit none. A broader, non-required `--detectOpenHandles` run that included the fake-timer Today suite timed out one pre-existing explicit-start test, while the required mutation-only run passed cleanly. npm continues to report the existing unknown `http-proxy` config warning. Migration application remains unverified because no disposable database was available.
