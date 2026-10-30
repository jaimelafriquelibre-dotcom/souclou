CREATE TABLE "MagicLinkRateLimit" (
    "key" VARCHAR(64) NOT NULL,
    "attempts" INTEGER NOT NULL,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MagicLinkRateLimit_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "MagicLinkRateLimit_updatedAt_idx"
ON "MagicLinkRateLimit"("updatedAt");