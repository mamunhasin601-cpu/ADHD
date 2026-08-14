-- Nullable so all existing tasks remain explicitly unstarted.
ALTER TABLE "tasks" ADD COLUMN "startedAt" TIMESTAMP(3);
