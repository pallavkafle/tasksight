export type Clock = () => number;

export interface ModelLimits {
  rpm: number;
  rpd: number;
}

export type AcquireResult =
  | { ok: true }
  | { ok: false; reason: "rate_limited"; retryAfterMs: number }
  | { ok: false; reason: "quota"; retryAfterMs: null };

// The provider's "day" resets at midnight US Pacific, so the daily counter uses that date.
export function pacificDayKey(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

export class TokenBucket {
  private readonly capacity: number;
  private readonly msPerToken: number;
  private readonly now: Clock;
  private tokens: number;
  private last: number;

  constructor(perMinute: number, now: Clock) {
    this.capacity = perMinute;
    this.msPerToken = 60_000 / perMinute;
    this.now = now;
    this.tokens = perMinute;
    this.last = now();
  }

  take(): { ok: true } | { ok: false; retryAfterMs: number } {
    const t = this.now();
    this.tokens = Math.min(this.capacity, this.tokens + (t - this.last) / this.msPerToken);
    this.last = t;
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return { ok: true };
    }
    return { ok: false, retryAfterMs: Math.ceil((1 - this.tokens) * this.msPerToken) };
  }
}

export class ModelLimiter {
  private readonly bucket: TokenBucket;
  private readonly rpd: number;
  private readonly now: Clock;
  private dayKey: string;
  private used = 0;

  constructor(limits: ModelLimits, now: Clock) {
    this.bucket = new TokenBucket(limits.rpm, now);
    this.rpd = limits.rpd;
    this.now = now;
    this.dayKey = pacificDayKey(now());
  }

  acquire(): AcquireResult {
    const key = pacificDayKey(this.now());
    if (key !== this.dayKey) {
      this.dayKey = key;
      this.used = 0;
    }
    if (this.used >= this.rpd) return { ok: false, reason: "quota", retryAfterMs: null };

    const taken = this.bucket.take();
    if (!taken.ok) {
      return { ok: false, reason: "rate_limited", retryAfterMs: taken.retryAfterMs };
    }
    // Only a call that really goes out counts against the day.
    this.used++;
    return { ok: true };
  }
}

export class LlmLimiter {
  private readonly perModel = new Map<string, ModelLimiter>();

  constructor(limits: Record<string, ModelLimits>, now: Clock = Date.now) {
    for (const [model, l] of Object.entries(limits)) {
      this.perModel.set(model, new ModelLimiter(l, now));
    }
  }

  // A model with no configured limit is not limited.
  acquire(model: string): AcquireResult {
    const limiter = this.perModel.get(model);
    return limiter ? limiter.acquire() : { ok: true };
  }
}
