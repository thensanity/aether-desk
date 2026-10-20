import { describe, expect, it } from "vitest";
import { formatToken, parseToken } from "./format";

describe("token units", () => {
  it("round-trips decimal strings through bigint wei", () => {
    expect(parseToken("1", 18)).toBe(10n ** 18n);
    expect(parseToken("1.5", 18)).toBe(1_500_000_000_000_000_000n);
    expect(formatToken(1_250_000_000_000_000_000n)).toBe("1.25");
    expect(formatToken(10n ** 18n, 18, 4)).toBe("1");
  });

  it("rejects extra precision", () => {
    expect(() => parseToken("1.0000000000000000001", 18)).toThrow(/decimal/);
  });
});
