# Task 0011J: Reconcile User Schema Migration Drift

**Status:** ready for autonomous implementation  
**Source:** Product Review of Package 0011 live e2e verification

## Goal

Bring the PostgreSQL migration history and the current Prisma `User` model back into agreement so
fresh and existing databases can run the API and notification e2e suite.

## Evidence

`apps/api/prisma/schema.prisma` declares the `Plan` enum and the following `User` fields:

- `hasCompletedOnboarding Boolean @default(false)`
- `plan Plan @default(FREE)`
- `proExpiresAt DateTime?`
- `yandexId String? @unique`
- `vkId String? @unique`
- `mailruId String? @unique`

The applied migration history contains no migration for these objects. A read-only
`prisma migrate diff --from-url ... --to-schema-datamodel ... --script` produces the required enum,
six columns, and three unique indexes. Live e2e currently fails at `prisma.user.create()` because
`users.hasCompletedOnboarding` is absent from PostgreSQL.

## Authorization

Create and apply an additive Prisma migration autonomously inside the repository and update only
related schema/migration evidence documentation. Do not rewrite or delete applied migrations, use
`db push`, change Product Bible policy, alter notification behavior, or ask for confirmation before
editing project files.

## Functional Requirements

- Add one new, chronologically named migration after `20260805000001_notification_log_device_token`
  (for example `20260806000000_add_user_profile_plan_oauth_fields`).
- The migration must:
  - create enum `Plan` with values `FREE` and `PRO`;
  - add `users.hasCompletedOnboarding BOOLEAN NOT NULL DEFAULT false`;
  - add `users.plan Plan NOT NULL DEFAULT 'FREE'`;
  - add nullable `users.proExpiresAt TIMESTAMP(3)`;
  - add nullable `users.yandexId`, `users.vkId`, and `users.mailruId` text columns;
  - create unique indexes matching the Prisma `@unique` declarations for the three provider IDs.
- Preserve all existing rows and defaults; do not make existing user columns non-null without a
  backfill strategy.
- Run `prisma generate` after the schema/migration change.
- Validate both a database with the current three migrations and a clean database created from all
  migrations.

## Acceptance Criteria

- `npx.cmd prisma migrate deploy` applies the new migration to the reported Docker PostgreSQL
  database without manual SQL.
- `npx.cmd prisma migrate status` reports the database is up to date.
- `prisma migrate diff --from-url <test-db> --to-schema-datamodel prisma/schema.prisma --script`
  emits no SQL after the migration is applied.
- `users` contains all six fields with the declared types/defaults, `Plan` contains `FREE` and `PRO`,
  and provider ID unique indexes exist.
- `npm.cmd run test:e2e --workspace=apps/api` passes all three notification e2e tests with live
  Redis/PostgreSQL, or reports the exact next blocker without claiming success.
- Existing API unit/integration tests and `npm.cmd run build:api` remain green.
- No applied migration is modified, no `db push` is used, and no Product Bible file is changed.
- Record migration command output, database inspection output, and e2e result in the status
  documentation while preserving **NOT VERIFIED** for real-device smoke until it is actually run.

## Out of Scope

- Notification or OAuth runtime behavior changes.
- Removing legacy `expoPushToken`.
- Production deployment, backup, or rollback execution against an external production database.
- Device smoke; it remains a separate gate.

## Verification Commands

```powershell
cd apps/api
npx.cmd prisma generate
npx.cmd prisma migrate deploy
npx.cmd prisma migrate status
npx.cmd prisma migrate diff --from-url "$env:DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script
cd ../..
npm.cmd run test:e2e --workspace=apps/api
npm.cmd run test:api
npm.cmd run build:api
```

Finish with exact results and keep real-device smoke explicitly **NOT VERIFIED** unless a physical
device or emulator actually completes the matrix.
