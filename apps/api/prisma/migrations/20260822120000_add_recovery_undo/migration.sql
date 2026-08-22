CREATE TABLE "recovery_undos" (
  "id" UUID NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  CONSTRAINT "recovery_undos_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "recovery_undo_items" (
  "undoId" UUID NOT NULL,
  "taskId" TEXT NOT NULL,
  "previousStartTime" TIMESTAMP(3),
  "appliedStartTime" TIMESTAMP(3),
  "appliedUpdatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recovery_undo_items_pkey" PRIMARY KEY ("undoId", "taskId")
);
CREATE INDEX "recovery_undos_userId_expiresAt_idx" ON "recovery_undos"("userId", "expiresAt");
ALTER TABLE "recovery_undos" ADD CONSTRAINT "recovery_undos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recovery_undo_items" ADD CONSTRAINT "recovery_undo_items_undoId_fkey" FOREIGN KEY ("undoId") REFERENCES "recovery_undos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
