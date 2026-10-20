import { AbiCoder } from "ethers";
import { describe, expect, it } from "vitest";
import { erc20, vaultAbi } from "../abi";
import { createChainClient } from "./factory";

const silent: Eip1193Provider = {
  async request() {
    throw new Error("encode tests must not hit RPC");
  },
};

const vault = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const proof = [`0x${"ab".repeat(32)}`, `0x${"cd".repeat(32)}`];

describe("ethers and web3 encode the same calls", () => {
  it("matches deposit, approve, and bool calldata", async () => {
    const ethersClient = await createChainClient("ethers", silent);
    const web3Client = await createChainClient("web3", silent);
    const amount = 25n * 10n ** 18n;
    const calls = [
      ethersClient.encode(vaultAbi.deposit, [amount, proof]),
      ethersClient.encode(erc20.approve, [vault, amount]),
      ethersClient.encode(vaultAbi.setPaused, [true]),
    ];
    const other = [
      web3Client.encode(vaultAbi.deposit, [amount, proof]),
      web3Client.encode(erc20.approve, [vault, amount]),
      web3Client.encode(vaultAbi.setPaused, [true]),
    ];
    expect(other).toEqual(calls);
  });

  it("decodes the same balance, root, and paused flag", async () => {
    const ethersClient = await createChainClient("ethers", silent);
    const web3Client = await createChainClient("web3", silent);
    const coder = AbiCoder.defaultAbiCoder();
    const balance = coder.encode(["uint256"], [1_000n * 10n ** 18n]);
    const root = coder.encode(["bytes32"], [`0x${"12".repeat(32)}`]);
    const paused = coder.encode(["bool"], [true]);

    expect(ethersClient.decode(erc20.balanceOf, balance)[0]).toBe(web3Client.decode(erc20.balanceOf, balance)[0]);
    expect(String(ethersClient.decode(vaultAbi.allowlistRoot, root)[0]).toLowerCase()).toBe(
      String(web3Client.decode(vaultAbi.allowlistRoot, root)[0]).toLowerCase(),
    );
    expect(ethersClient.decode(vaultAbi.paused, paused)[0]).toBe(true);
    expect(web3Client.decode(vaultAbi.paused, paused)[0]).toBe(true);
    expect(ethersClient.decode(erc20.symbol, coder.encode(["string"], ["aUSD"]))[0]).toBe("aUSD");
    expect(web3Client.decode(erc20.symbol, coder.encode(["string"], ["aUSD"]))[0]).toBe("aUSD");
  });
});
