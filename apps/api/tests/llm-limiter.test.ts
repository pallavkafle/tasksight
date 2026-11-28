import { describe, expect, it } from "vitest";
import { LlmLimiter, TokenBucket, pacificDayKey } from "../src/llm/limiter";

function clock(start = Date.UTC(2026, 0, 15, 12, 0, 0)) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("pacificDayKey", () => {
  it("rolls over at midnight Pacific, in winter and in summer", () => {
    expect(pacificDayKey(Date.UTC(2026, 0, 15, 7, 59))).toBe("2026-01-14");
    expect(pacificDayKey(Date.UTC(2026, 0, 15, 8, 1))).toBe("2026-01-15");
    expect(pacificDayKey(Date.UTC(2026, 6, 15, 6, 59))).toBe("2026-07-14");
    expect(pacificDayKey(Date.UTC(2026, 6, 15, 7, 1))).toBe("2026-07-15");
  });
});

describe("TokenBucket", () => {
  it("allows a burst up to the per-minute limit, then reports the wait", () => {
    const c = clock();
    const bucket = new TokenBucket(3, c.now);
    expect(bucket.take().ok).toBe(true);
    expect(bucket.take().ok).toBe(true);
    expect(bucket.take().ok).toBe(true);
    const blocked = bucket.take();
    expect(blocked).toEqual({ ok: false, retryAfterMs: 20_000 });
  });

  it("refills one token per interval and never above capacity", () => {
    const c = clock();
    const bucket = new TokenBucket(3, c.now);
    for (let i = 0; i < 3; i++) bucket.take();
    c.advance(20_000);
    expect(bucket.take().ok).toBe(true);
    expect(bucket.take().ok).toBe(false);
    c.advance(10 * 60_000);
    for (let i = 0; i < 3; i++) expect(bucket.take().ok).toBe(true);
    expect(bucket.take().ok).toBe(false);
  });
});

describe("LlmLimiter", () => {
  it("does not limit an unknown model", () => {
    const limiter = new LlmLimiter({}, clock().now);
    expect(limiter.acquire("anything").ok).toBe(true);
  });

  it("a rate-limited call does not use up the daily quota", () => {
    const c = clock();
    const limiter = new LlmLimiter({ m: { rpm: 1, rpd: 2 } }, c.now);
    expect(limiter.acquire("m").ok).toBe(true);
    expect(limiter.acquire("m")).toMatchObject({ ok: false, reason: "rate_limited" });
    c.advance(60_000);
    expect(limiter.acquire("m").ok).toBe(true);
    c.advance(60_000);
    expect(limiter.acquire("m")).toEqual({ ok: false, reason: "quota", retryAfterMs: null });
  });

  it("resets the daily count after midnight Pacific", () => {
    const c = clock(Date.UTC(2026, 0, 15, 7, 58));
    const limiter = new LlmLimiter({ m: { rpm: 100, rpd: 2 } }, c.now);
    expect(limiter.acquire("m").ok).toBe(true);
    expect(limiter.acquire("m").ok).toBe(true);
    expect(limiter.acquire("m")).toMatchObject({ ok: false, reason: "quota" });
    c.advance(3 * 60_000);
    expect(limiter.acquire("m").ok).toBe(true);
  });

  it("keeps separate limits per model", () => {
    const limiter = new LlmLimiter({ a: { rpm: 1, rpd: 5 }, b: { rpm: 1, rpd: 5 } }, clock().now);
    expect(limiter.acquire("a").ok).toBe(true);
    expect(limiter.acquire("a").ok).toBe(false);
    expect(limiter.acquire("b").ok).toBe(true);
  });
});
