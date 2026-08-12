-- Migration: add_device_tokens (ADR-009)
-- Adds per-device push token registry.
-- The legacy `expoPushToken` column on users is retained during the transition
-- so existing worker code keeps compiling. New code reads from device_tokens.

CREATE TABLE "device_tokens" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "token"      TEXT NOT NULL,
    "platform"   TEXT NOT NULL DEFAULT 'expo',
    "label"      TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt"  TIMESTAMP(3),
    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "device_tokens_token_key" ON "device_tokens"("token");
CREATE INDEX "device_tokens_userId_idx" ON "device_tokens"("userId");
CREATE INDEX "device_tokens_userId_revokedAt_idx" ON "device_tokens"("userId", "revokedAt");

ALTER TABLE "device_tokens"
    ADD CONSTRAINT "device_tokens_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
