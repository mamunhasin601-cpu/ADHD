# Task 0029 — Honest production-safe plan entitlement boundary

**Status:** completed by automated validation; production, payment, Android, and physical-device runtime remain unverified.

## Root cause and authoritative server contract

The authenticated `POST /plan/upgrade` and `POST /plan/downgrade` routes previously
called unrestricted persistence methods. A valid JWT was therefore enough to
change the current user's plan without payment or entitlement proof. The mobile
paywall invoked that development shortcut and described invented commercial and
feature terms as available.

`GET /plan` remains authenticated and retains its existing response fields and
Free-limit behavior. Both POST routes remain authenticated development tools,
but the service checks the environment before any database write:

```text
NODE_ENV !== "production" AND ENABLE_DEV_PLAN_MUTATIONS === "true"
```

Every other configuration returns HTTP 404. In particular, production wins over
an accidentally enabled flag, and missing, empty, `false`, differently cased,
whitespace-padded, or malformed values fail closed. A denied call performs no
plan update.

An allowed call derives its target user exclusively from the authenticated JWT;
no request user identity is accepted. Upgrade and downgrade therefore affect
only that owner, including on repeated calls. After an allowed write, the API
emits a structured `development_plan_mutation` log with only the actor's opaque
user ID and target plan. It does not include tokens, email, phone, password,
payment, or other sensitive values.

No billing provider, receipt or entitlement proof, webhook, subscription model,
table, or migration was added. These endpoints are not a production activation
mechanism.

## Mobile truthfulness boundary

The limit screen performs only the existing authenticated `GET /plan` query. It
does not invoke either plan mutation and contains no hidden development control.
It describes the current Free maximum of 50 active tasks and offers a calm
`Вернуться к задачам` action so the user can complete, edit, or delete existing
work. It makes no price, trial, purchase-success, subscription-activation, or
unverified Pro-feature promise.

Loading reports that usage is being checked. A query error explicitly says the
plan and tasks were not changed. Both states retain the back action and neither
can present activation success or mutate plan/task data.

## Automated validation — 2026-08-23

Automated tests are validation, not runtime evidence.

- Focused API: `npm test --workspace=apps/api -- --runInBand src/plan/plan.controller.auth.spec.ts`
  — **PASS**, 1 suite, 14 tests.
- Full API: `npm test --workspace=apps/api -- --runInBand`
  — **PASS**, 29 suites, 353 tests. Existing intentional error-path logs remained visible.
- Focused mobile: `TZ=UTC npm test --workspace=apps/mobile -- --runInBand tests/paywall.spec.tsx`
  — **PASS**, 1 suite, 4 tests.
- Full mobile: `TZ=UTC npm test --workspace=apps/mobile -- --runInBand`
  — **PASS**, 43 suites, 561 tests. Existing React test `act(...)` warnings from
  `today-create-task.spec.tsx` remained visible.
- API build: `npm run build --workspace=apps/api` — **PASS**.
- Mobile TypeScript: `npx tsc --noEmit -p apps/mobile/tsconfig.json` — **PASS**.
- Prisma client generation: `npm run prisma:generate --workspace=apps/api` — **PASS**.
- Prisma validation: `DATABASE_URL=postgresql://focus:focus@localhost:5432/focus npx prisma validate --schema apps/api/prisma/schema.prisma`
  — **PASS**. An initial invocation without an environment value failed closed
  with `P1012`; the placeholder rerun validates the schema without connecting.
- Whitespace check: `git diff --check` — **PASS**.

Focused server coverage proves unauthenticated denial; production precedence;
exact, case-sensitive flag handling; persisted-state stability on denial; owner
isolation for upgrade, downgrade, and repeated calls; compatible `GET /plan`;
and the allowlisted audit payload. Mobile coverage proves absence of the mutation
call and commercial/feature fiction, accurate Free-limit copy, a working back
action, and honest loading/error states.

## Runtime evidence and remaining gaps

No live API, PostgreSQL database, deployed production environment, mobile
packager, Android emulator, or physical device was started for Task 0029. No
existing smoke-test data was deleted or reset. Therefore there is **no new
runtime evidence** for this task.

Production configuration/deployment behavior, any future payment or entitlement
provider, prices and subscription policy, Android runtime UI, and physical-device
behavior are **NOT VERIFIED**. A Product Owner decision is still required before
implementing real billing, pricing, subscriptions, receipts, or production
entitlement activation.
