import { createHash } from "node:crypto";

export interface CacheKeyParts {
  feature: string;
  model: string;
  prompt: string;
  system?: string;
  json?: boolean;
}

// Each field is length-prefixed so two different splits can never produce the same hash input.
export function cacheKey(parts: CacheKeyParts): string {
  const hash = createHash("sha256");
  const fields = [
    parts.feature,
    parts.model,
    parts.system ?? "",
    parts.json ? "json" : "text",
    parts.prompt,
  ];
  for (const field of fields) {
    hash.update(`${field.length}:`);
    hash.update(field);
  }
  return hash.digest("hex");
}

interface Entry<T> {
  value: T;
  expiresAt: number;
}

// In memory only (one API instance). Least recently used entries are dropped first.
export class ResponseCache<T> {
  private readonly map = new Map<string, Entry<T>>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(maxEntries: number, ttlMs: number, now: () => number = Date.now) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
    this.now = now;
  }

  get(key: string): T | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.map.delete(key);
      return undefined;
    }
    // Re-insert so this key becomes the most recently used.
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    this.map.delete(key);
    this.map.set(key, { value, expiresAt: this.now() + this.ttlMs });
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next();
      if (oldest.done) break;
      this.map.delete(oldest.value);
    }
  }

  get size(): number {
    return this.map.size;
  }
}
