-- Optional, user-authored entry action. Existing rows remain NULL.
ALTER TABLE "tasks" ADD COLUMN "firstStep" TEXT;
