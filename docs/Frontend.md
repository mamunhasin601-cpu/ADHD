# Frontend

## Routing

Expo Router использует file-based routes:

- `app/index.tsx` перенаправляет по auth/onboarding state;
- `login.tsx`, `register.tsx`, `auth-provider-select.tsx`, `onboarding.tsx`, `paywall.tsx` — flow screens;
- `(tabs)/today.tsx`, `(tabs)/focus.tsx`, `(tabs)/settings.tsx` — основные tabs;
- `task-form.tsx` — create/edit task.

`app/_layout.tsx` предоставляет React Query client и Stack, `(tabs)/_layout.tsx` определяет три tabs.

## State и данные

- `stores/auth.store.ts` — auth/user state;
- `lib/secure-storage.ts` — device token persistence;
- `lib/api-client.ts` — HTTP boundary и refresh behavior;
- `lib/api/auth.ts`, `lib/api/tasks.ts`, `lib/api/plan.ts` — feature APIs/hooks;
- `components/timeline/` и `lib/timeline-layout.ts` — timeline UI/layout.

Today поддерживает выбор даты, quick add, toggle completion и открытие task form. Free-tier limit направляет пользователя на paywall. Push token регистрируется через `PATCH /users/me` в root layout.