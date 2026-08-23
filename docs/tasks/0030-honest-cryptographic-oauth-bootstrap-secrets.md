# Task 0030 — Honest cryptographic OAuth bootstrap secrets

**Status:** new-account creation boundary completed by automated validation;
historical credential and account-authentication policy remain unresolved.

## Root cause

OAuth account creation used `Math.random().toString(36).slice(-16)` for the
hidden password required by the Prisma `User.passwordHash` field. `Math.random`
is predictable and unsuitable for a credential. The result was hashed with
bcrypt cost 10 even though ordinary password registration uses cost 12. There
was no focused OAuth/Auth regression suite protecting creation, existing-provider
login, or account-linking behavior.

## Exact security contract

Only the genuinely new-user branch generates an opaque bootstrap secret. It
requests exactly 32 bytes from Node `crypto.randomBytes`, encodes them with
`base64url`, and hashes the result with bcrypt cost 12. Both OAuth bootstrap and
ordinary registration import that work factor from one authoritative constant.

Existing provider identities return the existing JWT token shape without a
write. Email- and phone-based linking write only the provider-ID field and keep
the existing password hash. A callback without email and phone retains the calm
400 response and performs neither randomness, hashing, user creation, nor token
generation. Randomness and bcrypt failures occur before `user.create`, so those
failures cannot create a user, issue tokens, or write a partial provider link.
The secret and hash are never returned or logged. Provider-ID mapping, the
`Europe/Moscow` default, JWT behavior, and the existing generic authentication
errors are unchanged.

## Database and historical boundary

The Prisma schema remains unchanged and no migration is created. `passwordHash`
is still required, so a CSPRNG secret satisfies the current persistence contract
without pretending the application has implemented passwordless accounts.

Existing records are not automatically rotated. A historical account can have
both a user-selected password and OAuth identities, and current data cannot
safely distinguish that account from an OAuth-only account. Bulk replacement
could therefore destroy a valid credential. Nullable hashes, an auth-method
enum, migration, password reset, and account-linking redesign require a separate
account-authentication policy decision.

## Automated validation — 2026-08-23

Automated tests are validation, not runtime evidence.

- Focused OAuth/Auth tests: `npm test --workspace @focus/api -- --runInBand auth/oauth.service.spec.ts auth/auth.service.spec.ts`
  — **PASS**, 2 suites, 10 tests.
- Full API tests: `JWT_SECRET=test-access-secret-at-least-32-characters JWT_REFRESH_SECRET=test-refresh-secret-at-least-32-characters npm test --workspace @focus/api -- --runInBand`
  — **PASS**, 31 suites, 363 tests. Existing intentional error-path logs
  (recovery reminder failures, Redis/DB failures, and notification delivery
  failures) remained visible. Before installing the already-declared workspace
  dependencies, an initial run stopped because `supertest` was absent from
  `node_modules`; `npm install` restored it and the recorded rerun passed.
- API build: `JWT_SECRET=test-access-secret-at-least-32-characters JWT_REFRESH_SECRET=test-refresh-secret-at-least-32-characters npm run build --workspace @focus/api`
  — **PASS**.
- Prisma Client generation: `npm run prisma:generate --workspace @focus/api`
  — **PASS**.
- Prisma schema validation: `DATABASE_URL=postgresql://focus:focus@localhost:5432/focus npx prisma validate --schema apps/api/prisma/schema.prisma`
  — **PASS** without a database connection.
- Whitespace validation: `git diff --check` — **PASS**.
- Production OAuth bootstrap search: `if rg -n 'Math\.random\(' apps/api/src/auth --glob '*oauth*.ts' --glob '!*.spec.ts'; then echo 'FAIL: production OAuth Math.random usage found'; exit 1; else echo 'PASS: no production OAuth bootstrap path uses Math.random()'; fi`
  — **PASS**, no production OAuth bootstrap path matched.

All npm commands emitted the existing `Unknown env config "http-proxy"`
deprecation warning. Dependency installation reported 74 audit findings (6 low,
35 moderate, 32 high, and 1 critical); dependency remediation is outside this
narrow task and was not hidden or auto-fixed.

The focused suite behaviorally covers all three provider mappings, a 32-byte
CSPRNG request, base64url secret hashing at shared cost 12, absence of
`Math.random` calls, token/log non-disclosure, existing-provider no-write login,
email and phone linking without password replacement, the identity-free 400
boundary, failure-before-write/token behavior for both randomness and bcrypt,
and compatible ordinary registration/login.

## Runtime evidence and explicit gaps

No live API, PostgreSQL database, OAuth provider callback, deployed environment,
mobile runtime, Android emulator, or physical device was started for Task 0030.
No existing smoke-test data was deleted or reset. Therefore there is **no new
runtime evidence**; automated tests and builds must not be interpreted as such.

Real-provider OAuth runtime, database runtime, deployment behavior, historical
OAuth-created hash remediation, passwordless/null-hash design, auth-method
classification, password reset, ambiguous linking/race policy, and credential
rotation remain **NOT VERIFIED / UNRESOLVED**. This task makes no claim that any
historical hash was rotated.
