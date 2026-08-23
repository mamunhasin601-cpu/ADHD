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

