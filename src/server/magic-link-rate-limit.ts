import "server-only";

import { Prisma } from "@/generated/prisma/client";
import {
  allowMagicLinkRequest,
  getMagicLinkRateLimitPolicy,
  type RateLimitResult,
  type RateLimitStore,
} from "@/lib/magic-link-rate-limit";
import { prisma } from "@/server/db";

async function consumeRateLimitBucket(
  key: string,
  now: Date,
  windowMs: number,
  maxAttempts: number,
): Promise<RateLimitResult> {
  const windowThreshold = new Date(now.getTime() - windowMs);
  const rows = await prisma.$queryRaw<Array<{ attempts: number }>>(Prisma.sql`
    INSERT INTO "MagicLinkRateLimit" ("key", "attempts", "windowStartedAt", "updatedAt")
    VALUES (${key}, 1, ${now}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "attempts" = CASE
        WHEN "MagicLinkRateLimit"."windowStartedAt" <= ${windowThreshold} THEN 1
        ELSE "MagicLinkRateLimit"."attempts" + 1
      END,
      "windowStartedAt" = CASE
        WHEN "MagicLinkRateLimit"."windowStartedAt" <= ${windowThreshold} THEN ${now}
        ELSE "MagicLinkRateLimit"."windowStartedAt"
      END,
      "updatedAt" = ${now}
    WHERE "MagicLinkRateLimit"."windowStartedAt" <= ${windowThreshold}
      OR "MagicLinkRateLimit"."attempts" < ${maxAttempts}
    RETURNING "attempts"
  `);

  if (!rows[0]) {
    return { allowed: false, attempts: maxAttempts };
  }

  return { allowed: true, attempts: rows[0].attempts };
}

const rateLimitStore: RateLimitStore = {
  consume: consumeRateLimitBucket,
  async deleteExpiredBefore(date) {
    await prisma.magicLinkRateLimit.deleteMany({
      where: { updatedAt: { lt: date } },
    });
  },
};

export async function isMagicLinkRequestAllowed(email: string) {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET is required for magic-link rate limiting.");
  }

  return allowMagicLinkRequest(
    email,
    secret,
    rateLimitStore,
    undefined,
    getMagicLinkRateLimitPolicy(),
  );
}