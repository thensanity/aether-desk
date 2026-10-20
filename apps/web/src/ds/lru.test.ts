import { describe, expect, it } from "vitest";
import { LruCache } from "./lru";

describe("LruCache", () => {
  it("evicts the least recently used key", () => {
    const cache = new LruCache<string, number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.get("a")).toBe(1);
    cache.set("c", 3);
    expect(cache.has("b")).toBe(false);
    expect(cache.get("a")).toBe(1);
    expect(cache.get("c")).toBe(3);
  });
});
