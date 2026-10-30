import { createHmac } from "node:crypto";

export type RateLimitPolicy = {
  windowMs: number;
  perEmail: number;
  global: number;
  retentionMs: number;
};

export const DEFAULT_MAGIC_LINK_RATE_LIMIT: RateLimitPolicy = {
  windowMs: 15 * 60 * 1000,
  perEmail: 3,
  global: 300,
  retentionMs: 24 * 60 * 60 * 1000,
};

function readPositiveInteger(
  value: string | undefined,
  fallback: number,
  maximum: number,
) {
  if (!value || !/^\d+$/.test(value)) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= maximum
    ? parsed
    : fallback;
}

export function getMagicLinkRateLimitPolicy(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): RateLimitPolicy {
  return {
    windowMs: readPositiveInteger(
      environment.MAGIC_LINK_WINDOW_MS,
      DEFAULT_MAGIC_LINK_RATE_LIMIT.windowMs,
      24 * 60 * 60 * 1000,
    ),
    perEmail: readPositiveInteger(
      environment.MAGIC_LINK_PER_EMAIL_LIMIT,
      DEFAULT_MAGIC_LINK_RATE_LIMIT.perEmail,
      100,
    ),
    global: readPositiveInteger(
      environment.MAGIC_LINK_GLOBAL_LIMIT,
      DEFAULT_MAGIC_LINK_RATE_LIMIT.global,
      100_000,
    ),
    retentionMs: readPositiveInteger(
      environment.MAGIC_LINK_RETENTION_MS,
      DEFAULT_MAGIC_LINK_RATE_LIMIT.retentionMs,
      90 * 24 * 60 * 60 * 1000,
    ),
  };
}

export type RateLimitResult = {
  allowed: boolean;
  attempts: number;
};

export interface RateLimitStore {
  consume(
    key: string,
    now: Date,
    windowMs: number,
    maxAttempts: number,
  ): Promise<RateLimitResult>;
  deleteExpiredBefore(date: Date): Promise<void>;
}

function digestRateLimitKey(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function createMagicLinkRateLimitKeys(email: string, secret: string) {
  const normalizedEmail = email.trim().toLowerCase();

  return {
    global: digestRateLimitKey(secret, "magic-link:global"),
    email: digestRateLimitKey(secret, `magic-link:email:${normalizedEmail}`),
  };
}

export async function allowMagicLinkRequest(
  email: string,
  secret: string,
  store: RateLimitStore,
  now = new Date(),
  policy: RateLimitPolicy = DEFAULT_MAGIC_LINK_RATE_LIMIT,
) {
  const keys = createMagicLinkRateLimitKeys(email, secret);
  const emailResult = await store.consume(
    keys.email,
    now,
    policy.windowMs,
    policy.perEmail,
  );

  if (!emailResult.allowed) {
    return false;
  }

  const globalResult = await store.consume(
    keys.global,
    now,
    policy.windowMs,
    policy.global,
  );

  if (!globalResult.allowed) {
    return false;
  }

  if (globalResult.attempts === 1) {
    await store.deleteExpiredBefore(
      new Date(now.getTime() - policy.retentionMs),
    );
  }

  return true;
}