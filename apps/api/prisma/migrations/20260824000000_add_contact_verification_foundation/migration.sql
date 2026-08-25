CREATE TYPE "ContactVerificationChannel" AS ENUM ('EMAIL', 'PHONE');

ALTER TABLE "users"
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);

CREATE TABLE "contact_verification_challenges" (
  "id" UUID NOT NULL,
  "channel" "ContactVerificationChannel" NOT NULL,
  "destination" TEXT NOT NULL,
  "activeKey" TEXT,
  "pinDigest" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attemptsRemaining" INTEGER NOT NULL,
  "resendAvailableAt" TIMESTAMP(3) NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "verificationTokenDigest" TEXT,
  "verificationTokenExpiresAt" TIMESTAMP(3),
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contact_verification_challenges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contact_verification_challenges_activeKey_key"
  ON "contact_verification_challenges"("activeKey");
CREATE UNIQUE INDEX "contact_verification_challenges_verificationTokenDigest_key"
  ON "contact_verification_challenges"("verificationTokenDigest");
CREATE INDEX "contact_verification_challenges_channel_destination_createdAt_idx"
  ON "contact_verification_challenges"("channel", "destination", "createdAt");
CREATE INDEX "contact_verification_challenges_createdAt_idx"
  ON "contact_verification_challenges"("createdAt");
