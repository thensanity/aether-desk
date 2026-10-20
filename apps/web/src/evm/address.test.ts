import { getAddress } from "ethers";
import { describe, expect, it } from "vitest";
import { toChecksumAddress } from "./address";

describe("EIP-55", () => {
  it("matches ethers checksum for the public Hardhat account", () => {
    const raw = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
    expect(toChecksumAddress(raw)).toBe(getAddress(raw));
  });

  it("rejects short strings", () => {
    expect(() => toChecksumAddress("0x1234")).toThrow(/Invalid/);
  });
});
