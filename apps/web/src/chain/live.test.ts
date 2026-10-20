import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MerkleTree } from "@aether/merkle";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { humanize } from "../evm/errors";
import { decodeVaultLog } from "../services/logs";
import { approveDraft, depositDraft, pauseDraft, readAllowlisted, readPortfolio, withdrawDraft } from "../services/vaultService";
import type { ChainClient } from "../types";
import { createChainClient } from "./factory";

interface HardhatRuntime {
  ethers: {
    getSigners: () => Promise<Array<{ address: string }>>;
    deployContract: (name: string, args?: unknown[]) => Promise<{
      waitForDeployment: () => Promise<unknown>;
      getAddress: () => Promise<string>;
      mint: (to: string, amount: bigint) => Promise<{ wait: () => Promise<unknown> }>;
    }>;
    parseEther: (value: string) => bigint;
  };
  network: { provider: Eip1193Provider };
}

const here = path.dirname(fileURLToPath(import.meta.url));
const contractsDir = path.resolve(here, "../../../../contracts");
let restoreDir = () => {};

function loadHardhat(): HardhatRuntime {
  const previous = process.cwd();
  process.chdir(contractsDir);
  restoreDir = () => process.chdir(previous);
  const require = createRequire(path.join(contractsDir, "hardhat.config.cjs"));
  return require("hardhat") as HardhatRuntime;
}

describe("both transports on a Hardhat network", () => {
  let ethersClient: ChainClient;
  let web3Client: ChainClient;
  let owner = "";
  let stranger = "";
  let token = "";
  let vault = "";
  let tree: MerkleTree;

  beforeAll(async () => {
    const hre = loadHardhat();
    const [first, second] = await hre.ethers.getSigners();
    owner = first.address;
    stranger = second.address;
    tree = new MerkleTree([owner]);
    const tokenContract = await hre.ethers.deployContract("MockERC20");
    await tokenContract.waitForDeployment();
    token = await tokenContract.getAddress();
    const vaultContract = await hre.ethers.deployContract("SavingsVault", [token, tree.root()]);
    await vaultContract.waitForDeployment();
    vault = await vaultContract.getAddress();
    const minted = 1_000n * 10n ** 18n;
    await (await tokenContract.mint(owner, minted)).wait();
    await (await tokenContract.mint(stranger, minted)).wait();

    ethersClient = await createChainClient("ethers", hre.network.provider);
    web3Client = await createChainClient("web3", hre.network.provider);
  }, 120_000);

  afterAll(() => {
    restoreDir();
  });

  it("reads one portfolio through both libraries", async () => {
    const [fromEthers, fromWeb3] = await Promise.all([
      readPortfolio(ethersClient, owner, token, vault),
      readPortfolio(web3Client, owner, token, vault),
    ]);
    expect(fromEthers.symbol).toBe("aUSD");
    expect(fromEthers.decimals).toBe(18);
    expect(fromEthers.walletBalance).toBe(1_000n * 10n ** 18n);
    expect(fromEthers.vaultBalance).toBe(0n);
    expect(fromEthers.allowance).toBe(0n);
    expect(fromEthers.paused).toBe(false);
    expect(fromEthers.owner.toLowerCase()).toBe(owner.toLowerCase());
    expect(fromEthers.allowlistRoot.toLowerCase()).toBe(tree.root().toLowerCase());
    expect(fromWeb3).toEqual(fromEthers);
    expect(await ethersClient.getChainId()).toBe(await web3Client.getChainId());
    expect(await readAllowlisted(ethersClient, vault, owner, tree.getProof(owner) ?? [])).toBe(true);
    expect(await readAllowlisted(web3Client, vault, stranger, [])).toBe(false);
  }, 60_000);

  it("approves with ethers, deposits and withdraws with web3, and decodes the log", async () => {
    const amount = 25n * 10n ** 18n;
    const approved = await approveDraft(token, vault, amount).execute({ client: ethersClient, account: owner });
    expect((await approved.wait()).status).toBe(1);

    const proof = tree.getProof(owner);
    expect(proof).not.toBeNull();
    const deposited = await depositDraft(vault, amount, proof ?? []).execute({ client: web3Client, account: owner });
    expect((await deposited.wait()).status).toBe(1);

    const afterDeposit = await readPortfolio(ethersClient, owner, token, vault);
    expect(afterDeposit.vaultBalance).toBe(amount);
    expect(afterDeposit.allowance).toBe(0n);

    const withdrawn = await withdrawDraft(vault, 10n * 10n ** 18n).execute({ client: web3Client, account: owner });
    expect((await withdrawn.wait()).status).toBe(1);
    const afterWithdraw = await readPortfolio(web3Client, owner, token, vault);
    expect(afterWithdraw.vaultBalance).toBe(15n * 10n ** 18n);

    const [ethersLogs, web3Logs] = await Promise.all([
      ethersClient.getLogs({ address: vault, fromBlock: 0, toBlock: "latest" }),
      web3Client.getLogs({ address: vault, fromBlock: 0, toBlock: "latest" }),
    ]);
    const decoded = ethersLogs.map(decodeVaultLog).filter((log) => log !== null);
    expect(decoded.map((log) => log.kind)).toEqual(["Deposited", "Withdrawn"]);
    expect(decoded[0]?.amount).toBe(amount);
    expect(web3Logs.map((log) => log.transactionHash)).toEqual(ethersLogs.map((log) => log.transactionHash));
  }, 60_000);

  it("surfaces allowlist and pause reverts from a real estimate", async () => {
    const amount = 1n * 10n ** 18n;
    const strangerApproved = await approveDraft(token, vault, amount).execute({
      client: ethersClient,
      account: stranger,
    });
    expect((await strangerApproved.wait()).status).toBe(1);
    await expect(
      depositDraft(vault, amount, []).execute({ client: web3Client, account: stranger }),
    ).rejects.toSatisfy((err: unknown) => /allowlist/i.test(humanize(err)));

    const paused = await pauseDraft(vault, true).execute({ client: ethersClient, account: owner });
    expect((await paused.wait()).status).toBe(1);
    const proof = tree.getProof(owner) ?? [];
    await expect(
      depositDraft(vault, amount, proof).execute({ client: web3Client, account: owner }),
    ).rejects.toSatisfy((err: unknown) => /paused/i.test(humanize(err)));
  }, 60_000);
});
