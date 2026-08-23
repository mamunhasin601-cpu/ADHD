# Task 0031 — Honest fail-fast core API configuration

## Status and root cause

The core API previously had no authoritative startup configuration contract. `ConfigModule.forRoot()` did not validate its input, JWT secrets were captured eagerly during module import, bootstrap and authentication read configuration from different places, and BullMQ ignored the documented `REDIS_URL` in favor of undocumented `REDIS_HOST`/`REDIS_PORT` localhost fallbacks. As a result, malformed or incomplete configuration could be discovered late and inconsistently.

Task 0031 establishes one pure validation boundary. Validation parses configuration only; it does not connect to PostgreSQL, Redis, or any external service.

## Core environment contract

The required variables are:

- `NODE_ENV`: exactly `development`, `test`, or `production`. Missing, empty, differently cased, or whitespace-padded values fail.
- `DATABASE_URL`: a syntactically valid URL with the `postgresql:` or `postgres:` scheme and a host.
- `REDIS_URL`: a syntactically valid URL with the `redis:` or `rediss:` scheme and a host. No path or `/` selects no explicit database; a database path must be one non-negative integer segment.
- `JWT_SECRET` and `JWT_REFRESH_SECRET`: exact, non-whitespace-padded strings of at least 32 characters. They must differ and must not equal the known Russian `.env.example` placeholders or the explicitly listed common English example placeholders.

`PORT` is optional. If absent, validation supplies numeric `3000`. If present, it must be an exact decimal integer from `1` through `65535`; empty, padded, fractional, negative, zero, non-numeric, and out-of-range values fail.

Validation errors may name an invalid variable, but must not contain the supplied JWT secret, database or Redis URL, URL credentials, tokens, or other secret values. This is validation of explicit known placeholders and contract shape, not a claim that arbitrary secret entropy can be classified.

## Configuration ownership and preserved behavior

`ConfigModule` runs the contract during application construction. The resulting `ConfigService` is the single validated source used by:

- `AuthService` for access-token signing, refresh-token signing, and refresh-token verification;
- `JwtStrategy` for access-token verification;
- bootstrap for `NODE_ENV` and the numeric listening port;
- BullMQ for connection options derived only from `REDIS_URL`.

Access and refresh JWT payloads are unchanged. Access tokens continue to default to `15m` and refresh tokens to `30d` when their optional expiry overrides are absent.

Task 0029's plan mutation rule is preserved exactly:

```text
NODE_ENV !== "production" && ENABLE_DEV_PLAN_MUTATIONS === "true"
```

No Prisma schema was changed and no migration was added.

## Validation evidence and limits

Automated tests cover pure configuration acceptance and rejection, safe errors, Redis option mapping, shared JWT configuration consumption, and affected API authentication regressions. The API build, Prisma Client generation, and Prisma schema validation are automated validation only; they are not runtime evidence.

This task provides **no** live API, PostgreSQL, Redis, deployment, OAuth provider, Android emulator, or physical-device runtime evidence. It also does not implement or verify:

- OAuth provider credential configuration or provider adapters;
- safe external HTTP timeout, retry, and redaction transport;
- production deployment configuration or production runtime startup;
- broader production observability;
- Android emulator or physical-device application behavior.

Those OAuth, transport, production operations, observability, and device/runtime gaps remain follow-up work.

## Automated validation — 2026-08-23

The final focused regression command was:

```text
npm test --workspace=apps/api -- --runInBand src/config/core-environment.spec.ts src/config/redis-connection.spec.ts src/auth/auth.service.spec.ts src/plan/plan.controller.auth.spec.ts src/notifications/notifications.controller.auth.spec.ts src/tasks/tasks.controller.recovery.auth-integration.spec.ts
```

All 6 suites passed, with 105 tests passed and no snapshots. The suites were `core-environment.spec.ts`, `redis-connection.spec.ts`, `auth.service.spec.ts`, `plan.controller.auth.spec.ts`, `notifications.controller.auth.spec.ts`, and `tasks.controller.recovery.auth-integration.spec.ts`.

The complete API regression command was:

```text
npm test --workspace=apps/api -- --runInBand
```

All 33 suites passed, with 422 tests passed and no snapshots. Intentional error-path logs remained visible for simulated database and Redis failures, reminder partial/failure paths, push failures, and recovery failure paths.

The remaining automated checks passed with these exact commands:

```text
npm run build:api
npm run prisma:generate --workspace=apps/api
DATABASE_URL='postgresql://placeholder:placeholder@localhost:5432/focus_validation' npx prisma validate --schema apps/api/prisma/schema.prisma
git diff --check
rg -n "jwt-secrets" apps/api/src --glob '!*.spec.ts'
rg -n "process\.env\.(JWT_SECRET|JWT_REFRESH_SECRET)" apps/api/src --glob '!*.spec.ts'
rg -n "REDIS_HOST|REDIS_PORT" apps/api/src --glob '!*.spec.ts'
git status --porcelain
```

The API build completed, Prisma Client 5.16.2 was generated, and Prisma reported the schema valid using the non-secret placeholder database URL. `git diff --check` produced no errors. Each of the three production-source searches produced no matches. Final `git status --porcelain` was empty after the follow-up commit.

The npm commands emitted the existing `Unknown env config "http-proxy"` warning. Dependency installation also reported the existing deprecation notices for `supertest@6.3.4` and `superagent@8.1.2`, plus 74 audit findings (6 low, 35 moderate, 32 high, and 1 critical).

These automated tests, build, client generation, and schema validation are **validation, not runtime evidence**. They do not change the live API, PostgreSQL, Redis, deployment, OAuth provider, Android emulator, or physical-device runtime-evidence limitations recorded above.
