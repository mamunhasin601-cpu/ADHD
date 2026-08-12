# Task 0011L: Verify Clean-Database Migration Path

**Status:** ready for autonomous implementation  
**Source:** Product Review of Task 0011J/0011K

## Goal

Prove that a fresh PostgreSQL database can be created solely by applying every committed Prisma
migration in order, then run the notification e2e gate against that clean database.

## Authorization

Use an isolated disposable test database/container autonomously. Do not modify the shared `focus_db`,
rewrite applied migrations, use `db push`, change production code, or change Product Bible policy.
Update status evidence documentation only after commands complete.

## Requirements

- Start an isolated PostgreSQL instance or disposable database with the repository's documented
  credentials; do not destroy the existing `focus_db` volume.
- Apply all migrations from an empty database using `prisma migrate deploy`.
- Run read-only schema inspection and `prisma migrate diff` against the clean database.
- Run `npm.cmd run test:e2e --workspace=apps/api` with the clean database and live Redis.
- Record exact database isolation, migration, diff, and e2e commands/results.
- If the environment cannot provide an isolated database, report the clean path as **NOT VERIFIED**;
  do not substitute the incrementally-grown dev database.

## Acceptance Criteria

- All four migrations apply successfully from empty, in chronological order.
- Clean database `prisma migrate status` reports up to date.
- Clean database schema diff emits only an empty migration/no SQL changes.
- Notification e2e passes `3/3` against the clean database, or the exact next blocker is recorded.
- Existing shared `focus_db` is not reset or deleted.
- Status docs distinguish clean-database evidence from the existing-database evidence and preserve
  `NOT VERIFIED` for real-device smoke.
- No applied migration or production source file is changed.

## Verification Commands

```powershell
npx.cmd prisma migrate deploy
npx.cmd prisma migrate status
npx.cmd prisma migrate diff --from-url <CLEAN_DATABASE_URL> --to-schema-datamodel prisma/schema.prisma --script
npm.cmd run test:e2e --workspace=apps/api
git diff --check -- docs/ADR docs/ai
```

Finish with an evidence table identifying the database target for every command.
