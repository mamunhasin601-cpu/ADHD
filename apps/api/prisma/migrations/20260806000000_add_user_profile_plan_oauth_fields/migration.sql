-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO');

-- AlterTable: Add new User profile, plan, and OAuth provider ID fields
ALTER TABLE "users" ADD COLUMN "hasCompletedOnboarding" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "plan" "Plan" NOT NULL DEFAULT 'FREE';
ALTER TABLE "users" ADD COLUMN "proExpiresAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "yandexId" TEXT;
ALTER TABLE "users" ADD COLUMN "vkId" TEXT;
ALTER TABLE "users" ADD COLUMN "mailruId" TEXT;

-- CreateIndex: Unique constraints for OAuth provider IDs
CREATE UNIQUE INDEX "users_yandexId_key" ON "users"("yandexId");
CREATE UNIQUE INDEX "users_vkId_key" ON "users"("vkId");
CREATE UNIQUE INDEX "users_mailruId_key" ON "users"("mailruId");
