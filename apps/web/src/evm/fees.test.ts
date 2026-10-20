import { describe, expect, it } from "vitest";
import { ema, suggestFees } from "./fees";

describe("fees", () => {
  it("doubles the base fee and keeps a default tip", () => {
    const quote = suggestFees(100n, 0n);
    expect(quote.maxPriorityFeePerGas).toBe(1_000_000_000n);
    expect(quote.maxFeePerGas).toBe(200n + 1_000_000_000n);
  });

  it("moves an average halfway at 50% alpha", () => {
    expect(ema(100n, 200n, 5_000n)).toBe(150n);
    expect(ema(null, 42n)).toBe(42n);
  });
});
