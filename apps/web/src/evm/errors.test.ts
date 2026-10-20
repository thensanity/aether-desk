import { id } from "ethers";
import { describe, expect, it } from "vitest";
import { decodeRevert, humanize } from "./errors";

describe("revert decoding", () => {
  it("maps a custom error selector to a sentence", () => {
    const data = id("NotAllowlisted()").slice(0, 10);
    expect(decodeRevert(data)).toMatch(/allowlist/);
  });

  it("reads a user rejection out of a wallet error", () => {
    expect(humanize(new Error("user rejected the request"))).toMatch(/rejected/);
  });

  it("reads a custom error wrapped the way web3.js wraps estimateGas", () => {
    const data = id("NotAllowlisted()").slice(0, 10);
    const wrapped = new Error("Error happened while trying to execute a function inside a smart contract");
    (wrapped as Error & { cause?: unknown }).cause = { data };
    expect(humanize(wrapped)).toMatch(/allowlist/);
  });
});
