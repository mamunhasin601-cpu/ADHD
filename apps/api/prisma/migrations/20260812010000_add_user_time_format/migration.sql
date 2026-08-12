CREATE TYPE "TimeFormat" AS ENUM ('SYSTEM', 'H24', 'H12');

ALTER TABLE "users" ADD COLUMN "timeFormat" "TimeFormat" NOT NULL DEFAULT 'SYSTEM';
