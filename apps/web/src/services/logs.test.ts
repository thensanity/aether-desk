import { AbiCoder, id, zeroPadValue } from "ethers";
import { describe, expect, it } from "vitest";
import { decodeVaultLog } from "./logs";

describe("vault logs", () => {
  it("decodes a deposited event", () => {
    const account = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    const amount = 25n * 10n ** 18n;
    const decoded = decodeVaultLog({
      address: "0x0000000000000000000000000000000000000001",
      topics: [id("Deposited(address,uint256)"), zeroPadValue(account, 32)],
      data: AbiCoder.defaultAbiCoder().encode(["uint256"], [amount]),
      blockNumber: 4,
      transactionHash: `0x${"ab".repeat(32)}`,
    });
    expect(decoded).toMatchObject({ kind: "Deposited", account, amount, blockNumber: 4 });
  });
});
