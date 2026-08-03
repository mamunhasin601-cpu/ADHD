# ADR-004: JWT Bearer authentication

## Context

`AuthService` реализует register/login flow: пользователь создаётся или находится по email/phone, пароль проверяется через bcrypt, после чего генерируется пара `accessToken` и `refreshToken`.

Access token подписывается с `JWT_SECRET` и сроком по умолчанию `15m`; refresh token подписывается с `JWT_REFRESH_SECRET` и сроком по умолчанию `30d`. `AuthModule` подключает `PassportModule`, `JwtModule`, `AuthService`, `OAuthService`, OAuth controllers и `JwtStrategy`.

Mobile `apiClient` устанавливает `Authorization: Bearer <token>` в заголовки запросов и имеет response interceptor для обновления access token через `/auth/refresh` при 401.

## Decision

Использовать JWT Bearer authentication с access/refresh token pair:

- backend выдаёт `accessToken` и `refreshToken`;
- protected HTTP routes используют JWT strategy/guard;
- mobile client передаёт access token через `Authorization: Bearer`;
- mobile client пытается обновить access token через refresh token при 401.

## Consequences

- Auth state на клиенте должен хранить оба токена.
- Backend остаётся stateless относительно refresh token storage: в найденном коде нет server-side refresh-token store, rotation или revocation endpoint.
- При неуспешном refresh mobile client вызывает logout и очищает локальную сессию.

## Alternatives

В найденном коде не обнаружены session-cookie authentication, server-side session store, refresh-token rotation/revocation или другой текущий primary auth mechanism. OAuth controllers существуют как provider-specific entry points, но они также интегрируются с token-based auth flow.

## Sources

- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/auth/auth.module.ts`
- `apps/mobile/lib/api-client.ts`
- `apps/mobile/stores/auth.store.ts`
- `docs/Authentication.md`
- `docs/Architecture.md`