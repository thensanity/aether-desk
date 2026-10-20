import { describe, expect, it } from "vitest";
import { RingBuffer } from "./ring";

describe("RingBuffer", () => {
  it("keeps the newest items once full", () => {
    const ring = new RingBuffer<number>(3);
    for (const value of [1, 2, 3, 4, 5]) ring.push(value);
    expect(ring.toArray()).toEqual([3, 4, 5]);
  });
});
