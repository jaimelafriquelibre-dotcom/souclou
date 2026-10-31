import "server-only";

import { Prisma } from "@/generated/prisma/client";
import {
  CREDENTIAL_ATTEMPT_WINDOW_MS,
  createCredentialAttemptKey,
  isCredentialAttemptAllowed,
} from "@/lib/credential-rate-limit";
import { prisma } from "@/server/db";

export async function consumeCredentialAttempt(username: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is required for credential rate limiting.");
  }

  const key = createCredentialAttemptKey(username, secret);
  const attempts = await prisma.$transaction(async (transaction) => {
    const result = await transaction.$queryRaw<{ attempts: number }[]>(Prisma.sql`
      INSERT INTO "AuthRateLimit" ("key", "attempts", "windowStartedAt", "updatedAt")
      VALUES (
        ${key},
        1,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("key") DO UPDATE SET
        "attempts" = CASE
          WHEN "AuthRateLimit"."windowStartedAt" <= CURRENT_TIMESTAMP - (${CREDENTIAL_ATTEMPT_WINDOW_MS} * INTERVAL '1 millisecond') THEN 1
          ELSE "AuthRateLimit"."attempts" + 1
        END,
        "windowStartedAt" = CASE
          WHEN "AuthRateLimit"."windowStartedAt" <= CURRENT_TIMESTAMP - (${CREDENTIAL_ATTEMPT_WINDOW_MS} * INTERVAL '1 millisecond') THEN CURRENT_TIMESTAMP
          ELSE "AuthRateLimit"."windowStartedAt"
        END,
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING "attempts"
    `);

    await transaction.$executeRaw(Prisma.sql`
      DELETE FROM "AuthRateLimit"
      WHERE "updatedAt" < CURRENT_TIMESTAMP - INTERVAL '24 hours'
    `);

    return result[0]?.attempts ?? Number.POSITIVE_INFINITY;
  });

  return isCredentialAttemptAllowed(attempts);
}

export async function clearCredentialAttempts(username: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is required for credential rate limiting.");
  }

  const key = createCredentialAttemptKey(username, secret);
  await prisma.$executeRaw(Prisma.sql`
    DELETE FROM "AuthRateLimit"
    WHERE "key" = ${key}
  `);
}
