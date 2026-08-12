-- Add deviceTokenId to notification_logs for per-device delivery tracking (Task 0011A)
ALTER TABLE "notification_logs"
    ADD COLUMN "deviceTokenId" TEXT;

ALTER TABLE "notification_logs"
    ADD CONSTRAINT "notification_logs_deviceTokenId_fkey"
    FOREIGN KEY ("deviceTokenId") REFERENCES "device_tokens"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "notification_logs_taskId_deviceTokenId_idx"
    ON "notification_logs"("taskId", "deviceTokenId");
