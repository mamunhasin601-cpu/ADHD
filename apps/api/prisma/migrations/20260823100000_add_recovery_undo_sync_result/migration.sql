ALTER TABLE "recovery_undos"
  ADD COLUMN "reminderSyncStatus" TEXT,
  ADD COLUMN "failedReminderSyncs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
