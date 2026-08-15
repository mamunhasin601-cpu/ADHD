# Task 0020 — Contextual notification permission

**Status: Completed**

## Root cause and product timing contract

Authenticated `RootLayout` previously called `runPushRegistration()`, whose first-install path could call Expo's native permission request before Today delivered value. Task 0020 resolves Task 0019's historical residual item: bootstrap is now passive, and the first OS dialog is owned only by an explicit user action after a real current/next task and canonical Now Card are visible on the profile-local Today view.

The inline invitation follows the required calm copy and sits after the Now Card without blocking **Начать**, **Мне трудно начать**, editing, completion, navigation, or task creation. It is absent during authentication/onboarding, loading/error, another calendar day, an empty/unscheduled-only day, and after defer, grant, denial, or revocation.

## Behavior and state model

Permission (`not-asked`, `granted`, `denied`) and per-install invitation disposition (`available`, `deferred`) use separate SecureStore keys. **Не сейчас** immediately persists only `deferred`; it never represents OS denial and performs no permission, token, or reconciliation operation. Settings always retains the later explicit path.

The compact **Напоминания** Settings section shows **Не настроены / Включить напоминания** for not-asked or deferred, **Включены / Открыть настройки** for granted, and **Выключены / Открыть настройки** for denied/revoked. The existing safe OS-settings helper remains the settings route.

## Ownership, concurrency, and lifecycle

`NotificationLifecycleProvider` is the single authority for passive bootstrap inspection, explicit permission requests, device registration, bounded reminder reconciliation, and AppState restoration/revocation. Its synchronous operation-generation guard is acquired before any await, coalesces rapid presses and resume overlap, rejects stale settlement, and prevents an old `finally` from releasing a newer operation. Mount setup restores the mounted ref; cleanup invalidates the owned generation. No polling, sleeps, event emitter, navigation, or additional task cache was introduced.

Existing grants bootstrap without prompting, register remote-primary exactly once, and reconcile the bounded horizon once. A registration failure selects the established local fallback only while permission is granted. Revocation selects no false local channel and cancels Focus-owned reminders; enabling through OS settings restores registration on resume. Inspection/request failures remain calm, inline, retryable, and independent of task/profile behavior.

Registration ownership is keyed to the authenticated user. A transition from User A through logout to User B invalidates A's generation and registers/reconciles exactly once for B, without adding a user ID to the authenticated device-registration payload or clearing device-level permission/invitation storage. Every awaited token, device POST, task-query, and reconciliation boundary revalidates both generation and owner; stale work cannot begin later channel or reminder side effects, and an older `finally` cannot release a newer guard.

Invitation hydration has its own mount-safe generation. A current **Не сейчас** action invalidates an older pending hydration, so a delayed `available` result or StrictMode cleanup/replay cannot overwrite `deferred`. Successful current bootstrap, resume, or explicit operations clear prior lifecycle errors.

## Accessibility

Invitation and Settings actions expose button roles. Pending actions expose disabled and busy state; status is available as text and an accessibility label; failure copy has alert semantics. The invitation uses wrapping text, minimum-height actions, neutral styling, and remains inline with existing safe-area behavior.

## Changed files

- `apps/mobile/app/_layout.tsx`
- `apps/mobile/app/(tabs)/today.tsx`
- `apps/mobile/app/(tabs)/settings.tsx`
- `apps/mobile/components/NotificationInvitation.tsx`
- `apps/mobile/components/NotificationInvitation.spec.tsx`
- `apps/mobile/lib/notification-lifecycle.tsx`
- `apps/mobile/lib/notification-permission.ts`
- `apps/mobile/lib/notification-permission.spec.ts`
- `apps/mobile/lib/notification-lifecycle.spec.tsx`
- `apps/mobile/tests/_layout.spec.tsx`
- `apps/mobile/tests/settings-time-format.spec.tsx`
- `apps/mobile/tests/today-notification-invitation.spec.tsx`
- `apps/mobile/tests/today-create-task.spec.tsx`
- `apps/mobile/tests/today-start-task.spec.tsx`
- `Product-Bible/09-Roadmap/Feature-Roadmap.md`
- `docs/tasks/0020-contextual-notification-permission.md`

## Validation, warnings, and residual limitations

Validation commands and final Jest totals:

- `npm test --workspace @focus/mobile -- --runInBand` — 30 suites, 385 tests passed. This exceeds the exact Task 0019 base inventory of 27 suites / 366 tests and restores the meaningful Task 0011 lifecycle evidence removed by the first Task 0020 commit.
- `npm test --workspace @focus/mobile -- --runInBand apps/mobile/lib/notification-lifecycle.spec.tsx apps/mobile/tests/_layout.spec.tsx --detectOpenHandles` — 2 suites, 22 tests passed.
- `npm test --workspace @focus/mobile -- --runInBand apps/mobile/lib/notification-permission.spec.ts apps/mobile/components/NotificationInvitation.spec.tsx apps/mobile/tests/today-notification-invitation.spec.tsx apps/mobile/tests/today-start-task.spec.tsx apps/mobile/tests/settings-time-format.spec.tsx apps/mobile/tests/onboarding.spec.tsx apps/mobile/tests/auth-routing.spec.ts apps/mobile/components/NowCard.spec.tsx apps/mobile/lib/local-notifications.spec.ts apps/mobile/components/NotificationPermissionBanner.spec.tsx` — 10 suites, 125 tests passed.
- `npx tsc --noEmit -p apps/mobile/tsconfig.json`.
- `git diff --check` plus final diff-stat and complete-diff review.

The existing npm `http-proxy` configuration warning and pre-existing React test warnings are not hidden or relabeled. No Android emulator/device was available: **NOT VERIFIED**. Real-device validation remains a release gate for native prompt timing, denial non-looping, grant registration/reconciliation, and defer behavior. Jest mocks are not device evidence.
