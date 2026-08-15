-- Task 0022: distinguish one user-authored series from bounded concrete occurrences.
ALTER TABLE "tasks" ADD COLUMN "recurrenceTimezone" TEXT;
ALTER TABLE "tasks" ADD COLUMN "recurrenceDateKey" TEXT;
ALTER TABLE "tasks" ADD COLUMN "recurrenceGeneratedThrough" TEXT;
ALTER TABLE "tasks" ADD COLUMN "seriesId" TEXT;

CREATE INDEX "tasks_seriesId_idx" ON "tasks"("seriesId");
CREATE UNIQUE INDEX "tasks_seriesId_recurrenceDateKey_key"
  ON "tasks"("seriesId", "recurrenceDateKey");
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_seriesId_fkey"
  FOREIGN KEY ("seriesId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backward-compatible policy: legacy supported recurring rows remain the series.
-- The application snapshots their owner's timezone and deterministically fills the
-- bounded horizon on the first explicit extension; no legacy row is copied here.
UPDATE "tasks" AS t SET "recurrenceTimezone" = u."timezone"
FROM "users" AS u
WHERE t."userId" = u."id" AND t."isRecurring" = true
  AND t."recurrenceRule" IN ('FREQ=DAILY', 'FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR');

-- Unsupported rules were accepted by the old /^FREQ=/ validator. Preserve the
-- original row and all user state as one ordinary actionable task instead of
-- hiding it as a series template.
UPDATE "tasks"
SET "isRecurring" = false,
    "recurrenceRule" = NULL,
    "recurrenceTimezone" = NULL,
    "recurrenceDateKey" = NULL,
    "recurrenceGeneratedThrough" = NULL
WHERE "isRecurring" = true
  AND ("recurrenceRule" IS NULL OR "recurrenceRule" NOT IN
    ('FREQ=DAILY', 'FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR'));
