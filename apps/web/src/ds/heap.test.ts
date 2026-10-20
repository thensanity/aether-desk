import { describe, expect, it } from "vitest";
import { Heap } from "./heap";

describe("Heap", () => {
  it("pops in the order defined by before()", () => {
    const heap = new Heap<number>((a, b) => a < b);
    for (const value of [5, 1, 4, 2, 3]) heap.push(value);
    const popped: number[] = [];
    while (heap.size > 0) popped.push(heap.pop() as number);
    expect(popped).toEqual([1, 2, 3, 4, 5]);
  });
});
