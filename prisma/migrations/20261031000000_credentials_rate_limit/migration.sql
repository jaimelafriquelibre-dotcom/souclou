ALTER TABLE "MagicLinkRateLimit" RENAME TO "AuthRateLimit";

ALTER INDEX "MagicLinkRateLimit_updatedAt_idx"
RENAME TO "AuthRateLimit_updatedAt_idx";