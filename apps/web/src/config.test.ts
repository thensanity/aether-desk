import { describe, expect, it } from "vitest";
import { isZeroAddress, lookupDeployment } from "./config";
import type { Deployment } from "./types";

const ZERO = "0x0000000000000000000000000000000000000000";
const TOKEN = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const VAULT = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

const table: Record<string, Deployment> = {
  "1": { token: ZERO, vault: ZERO, allowlistRoot: `0x${"00".repeat(32)}` },
  "31337": { token: TOKEN, vault: VAULT, allowlistRoot: `0x${"11".repeat(32)}` },
};

describe("deployment lookup", () => {
  it("hides a chain whose vault is still the zero address", () => {
    expect(isZeroAddress(ZERO)).toBe(true);
    expect(lookupDeployment(table, 1)).toBeNull();
    expect(lookupDeployment(table, 999)).toBeNull();
  });

  it("returns the vault once a chain has a real address", () => {
    expect(lookupDeployment(table, 31337)).toEqual(table["31337"]);
  });
});
