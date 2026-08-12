-- Preserve every existing numeric duration while making unknown duration a
-- first-class value for future writes.
ALTER TABLE "tasks" ALTER COLUMN "durationMinutes" DROP DEFAULT;
ALTER TABLE "tasks" ALTER COLUMN "durationMinutes" DROP NOT NULL;
