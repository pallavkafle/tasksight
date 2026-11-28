import { describe, expect, it } from "vitest";
import { ResponseCache, cacheKey } from "../src/llm/cache";

const base = { feature: "parse_task", model: "m", prompt: "p" };

describe("cacheKey", () => {
  it("is stable and changes with every field", () => {
    expect(cacheKey(base)).toBe(cacheKey({ ...base }));
    const keys = new Set([
      cacheKey(base),
      cacheKey({ ...base, feature: "ask" }),
      cacheKey({ ...base, model: "m2" }),
      cacheKey({ ...base, prompt: "p2" }),
      cacheKey({ ...base, system: "s" }),
      cacheKey({ ...base, json: true }),
    ]);
    expect(keys.size).toBe(6);
  });

  it("cannot collide when text moves between fields", () => {
    expect(cacheKey({ feature: "a", model: "bc", prompt: "x" })).not.toBe(
      cacheKey({ feature: "ab", model: "c", prompt: "x" }),
    );
  });
});

describe("ResponseCache", () => {
  function setup(max = 2, ttl = 1000) {
    let t = 0;
    const cache = new ResponseCache<string>(max, ttl, () => t);
    return { cache, advance: (ms: number) => (t += ms) };
  }

  it("returns a stored value and undefined for a miss", () => {
    const { cache } = setup();
    cache.set("a", "1");
    expect(cache.get("a")).toBe("1");
    expect(cache.get("b")).toBeUndefined();
  });

  it("expires entries after the TTL", () => {
    const { cache, advance } = setup(2, 1000);
    cache.set("a", "1");
    advance(999);
    expect(cache.get("a")).toBe("1");
    advance(1);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("drops the least recently used entry when full", () => {
    const { cache } = setup(2);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.get("a");
    cache.set("c", "3");
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe("1");
    expect(cache.get("c")).toBe("3");
  });

  it("overwriting a key refreshes its value and its TTL", () => {
    const { cache, advance } = setup(2, 1000);
    cache.set("a", "1");
    advance(900);
    cache.set("a", "2");
    advance(900);
    expect(cache.get("a")).toBe("2");
    expect(cache.size).toBe(1);
  });
});
