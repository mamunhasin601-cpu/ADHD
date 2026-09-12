-- Marks whether the account timezone has been confirmed by the authenticated
-- mobile lifecycle. Existing rows remain NULL so their ambiguous historical
-- timestamps are not rewritten during the first adoption.
ALTER TABLE "users" ADD COLUMN "timezoneSyncedAt" TIMESTAMP(3);
