# ADR-005: Expo Router mobile state and data flow

## Context

Mobile application находится в `apps/mobile`. Документация описывает `apps/mobile/app/` как file-based routes и экраны, `apps/mobile/lib/` как API client/feature API/timeline helpers, `apps/mobile/stores/` как auth state.

`apps/mobile/app/_layout.tsx` создаёт `QueryClient` и оборачивает приложение в `QueryClientProvider`. Там же объявлен root `Stack` с routes `login`, `register`, `auth-provider-select`, `onboarding`, `paywall`, `(tabs)` и `task-form`.

`auth.store.ts` использует Zustand для auth/user state, восстанавливает сессию через `bootstrap()` и сохраняет/загружает токены через secure storage helpers.

`api-client.ts` использует axios singleton с `EXPO_PUBLIC_API_URL` или default `http://10.0.2.2:3000`, timeout `10_000`, JSON headers и Bearer token setup.

## Decision

Использовать в mobile client следующую структуру:

- Expo Router file-based routing в `apps/mobile/app/`;
- React Query provider на root layout для server-state/data fetching;
- Zustand store для auth/user state;
- SecureStore-backed token persistence через `lib/secure-storage`;
- axios-based HTTP boundary через `lib/api-client.ts`.

## Consequences

- Navigation structure определяется файлами и root Stack layout.
- Auth bootstrap выполняется при старте приложения из root layout.
- API requests централизованы через общий axios client.
- Auth store и API client связаны через `setAuthToken` и dynamic import store в interceptor; эта связность уже отмечена research-документацией как архитектурный риск.

## Alternatives

В найденном коде не обнаружены альтернативные routing/state/data clients для mobile. Документация и файлы указывают на Expo Router, React Query, Zustand, SecureStore helpers и axios client как текущую реализацию.

## Sources

- `apps/mobile/app/_layout.tsx`
- `apps/mobile/stores/auth.store.ts`
- `apps/mobile/lib/api-client.ts`
- `docs/Frontend.md`
- `docs/Architecture.md`
- `docs/research/18-component-analysis.md`
- `docs/research/19-architecture-risk-report.md`