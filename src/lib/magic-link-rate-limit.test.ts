import { describe, expect, it } from "vitest";
import {
  allowMagicLinkRequest,
  createMagicLinkRateLimitKeys,
  DEFAULT_MAGIC_LINK_RATE_LIMIT,
  getMagicLinkRateLimitPolicy,
  type RateLimitResult,
  type RateLimitStore,
} from "./magic-link-rate-limit";

class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<
    string,
    { attempts: number; windowStartedAt: Date; updatedAt: Date }
  >();

  async consume(
    key: string,
    now: Date,
    windowMs: number,
    maxAttempts: number,
  ): Promise<RateLimitResult> {
    const bucket = this.buckets.get(key);
    const windowExpired =
      !bucket || now.getTime() - bucket.windowStartedAt.getTime() >= windowMs;

    if (windowExpired) {
      this.buckets.set(key, {
        attempts: 1,
        windowStartedAt: now,
        updatedAt: now,
      });
      return { allowed: true, attempts: 1 };
    }

    if (bucket.attempts >= maxAttempts) {
      return { allowed: false, attempts: bucket.attempts };
    }

    bucket.attempts += 1;
    bucket.updatedAt = now;
    return { allowed: true, attempts: bucket.attempts };
  }

  async deleteExpiredBefore(date: Date) {
    for (const [key, bucket] of this.buckets) {
      if (bucket.updatedAt < date) {
        this.buckets.delete(key);
      }
    }
  }

  attemptsFor(key: string) {
    return this.buckets.get(key)?.attempts ?? 0;
  }
}

describe("magic-link request limits", () => {
  it("limits each normalized e-mail address without consuming the global quota after rejection", async () => {
    const store = new MemoryRateLimitStore();
    const now = new Date("2026-10-30T12:00:00.000Z");

    expect(await allowMagicLinkRequest("Parent@example.ci", "test-secret", store, now)).toBe(true);
    expect(await allowMagicLinkRequest("parent@example.ci", "test-secret", store, now)).toBe(true);
    expect(await allowMagicLinkRequest(" parent@example.ci ", "test-secret", store, now)).toBe(true);
    expect(await allowMagicLinkRequest("parent@example.ci", "test-secret", store, now)).toBe(false);
    const keys = createMagicLinkRateLimitKeys("parent@example.ci", "test-secret");
    expect(store.attemptsFor(keys.global)).toBe(3);
  });

  it("enforces the global quota even when addresses differ", async () => {
    const store = new MemoryRateLimitStore();
    const now = new Date("2026-10-30T12:00:00.000Z");
    const policy = { ...DEFAULT_MAGIC_LINK_RATE_LIMIT, global: 2 };

    expect(await allowMagicLinkRequest("one@example.ci", "test-secret", store, now, policy)).toBe(true);
    expect(await allowMagicLinkRequest("two@example.ci", "test-secret", store, now, policy)).toBe(true);
    expect(await allowMagicLinkRequest("three@example.ci", "test-secret", store, now, policy)).toBe(false);
  });

  it("opens a new quota window after fifteen minutes", async () => {
    const store = new MemoryRateLimitStore();
    const now = new Date("2026-10-30T12:00:00.000Z");

    for (let attempt = 0; attempt < DEFAULT_MAGIC_LINK_RATE_LIMIT.perEmail; attempt += 1) {
      expect(await allowMagicLinkRequest("parent@example.ci", "test-secret", store, now)).toBe(true);
    }

    expect(
      await allowMagicLinkRequest(
        "parent@example.ci",
        "test-secret",
        store,
        new Date(now.getTime() + DEFAULT_MAGIC_LINK_RATE_LIMIT.windowMs),
      ),
    ).toBe(true);
  });

  it("stores only opaque HMAC keys, stable after e-mail normalization", () => {
    const first = createMagicLinkRateLimitKeys(" Parent@example.ci ", "test-secret");
    const normalized = createMagicLinkRateLimitKeys("parent@example.ci", "test-secret");
    const anotherSecret = createMagicLinkRateLimitKeys("parent@example.ci", "other-secret");

    expect(first.email).toBe(normalized.email);
    expect(first.email).not.toContain("parent@example.ci");
    expect(first.email).not.toBe(anotherSecret.email);
  });

  it("reads bounded quota settings and falls back on invalid values", () => {
    expect(
      getMagicLinkRateLimitPolicy({
        MAGIC_LINK_WINDOW_MS: "1200000",
        MAGIC_LINK_PER_EMAIL_LIMIT: "4",
        MAGIC_LINK_GLOBAL_LIMIT: "600",
        MAGIC_LINK_RETENTION_MS: "172800000",
      }),
    ).toEqual({
      windowMs: 1_200_000,
      perEmail: 4,
      global: 600,
      retentionMs: 172_800_000,
    });

    expect(
      getMagicLinkRateLimitPolicy({
        MAGIC_LINK_WINDOW_MS: "-1",
        MAGIC_LINK_PER_EMAIL_LIMIT: "not-a-number",
        MAGIC_LINK_GLOBAL_LIMIT: "100001",
        MAGIC_LINK_RETENTION_MS: "0",
      }),
    ).toEqual(DEFAULT_MAGIC_LINK_RATE_LIMIT);
  });
});