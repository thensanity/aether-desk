import { erc20, vaultAbi } from "../abi";
import { humanize } from "../evm/errors";
import type { AbiFunction, ChainClient, FeeQuote, Portfolio, SentTransaction } from "../types";
import type { TxDraft } from "./scheduler";

async function read(client: ChainClient, to: string, fragment: AbiFunction, args: unknown[]): Promise<unknown> {
  const data = client.encode(fragment, args);
  let raw: string;
  try {
    raw = await client.call({ to, data });
  } catch (err) {
    throw new Error(humanize(err));
  }
  if (!raw || raw === "0x") {
    throw new Error("Empty response. Deploy the contracts on this network, then reload.");
  }
  return client.decode(fragment, raw)[0];
}

function asBigint(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" || typeof value === "string") return BigInt(value);
  throw new Error("Expected an integer from the contract");
}

function asBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "bigint") return value !== 0n;
  if (value === "true" || value === "1") return true;
  return false;
}

export async function readPortfolio(
  client: ChainClient,
  account: string,
  token: string,
  vault: string,
): Promise<Portfolio> {
  const [symbol, decimals, walletBalance, allowance, vaultBalance, totalAssets, owner, paused, allowlistRoot, asset] =
    await Promise.all([
      read(client, token, erc20.symbol, []),
      read(client, token, erc20.decimals, []),
      read(client, token, erc20.balanceOf, [account]),
      read(client, token, erc20.allowance, [account, vault]),
      read(client, vault, vaultAbi.balanceOf, [account]),
      read(client, vault, vaultAbi.totalAssets, []),
      read(client, vault, vaultAbi.owner, []),
      read(client, vault, vaultAbi.paused, []),
      read(client, vault, vaultAbi.allowlistRoot, []),
      read(client, vault, vaultAbi.asset, []),
    ]);

  return {
    symbol: String(symbol),
    decimals: Number(asBigint(decimals)),
    walletBalance: asBigint(walletBalance),
    allowance: asBigint(allowance),
    vaultBalance: asBigint(vaultBalance),
    totalAssets: asBigint(totalAssets),
    owner: String(owner),
    paused: asBool(paused),
    allowlistRoot: String(allowlistRoot),
    asset: String(asset),
  };
}

export async function readVaultConfig(
  client: ChainClient,
  vault: string,
): Promise<{ owner: string; paused: boolean; allowlistRoot: string; asset: string }> {
  const [owner, paused, allowlistRoot, asset] = await Promise.all([
    read(client, vault, vaultAbi.owner, []),
    read(client, vault, vaultAbi.paused, []),
    read(client, vault, vaultAbi.allowlistRoot, []),
    read(client, vault, vaultAbi.asset, []),
  ]);
  return {
    owner: String(owner),
    paused: asBool(paused),
    allowlistRoot: String(allowlistRoot),
    asset: String(asset),
  };
}

export async function readAllowlisted(
  client: ChainClient,
  vault: string,
  account: string,
  proof: string[],
): Promise<boolean> {
  return asBool(await read(client, vault, vaultAbi.isAllowlisted, [account, proof]));
}

async function submit(
  client: ChainClient,
  account: string,
  to: string,
  fragment: AbiFunction,
  args: unknown[],
  fee: FeeQuote,
): Promise<SentTransaction> {
  const data = client.encode(fragment, args);
  const gasLimit = await client.estimateGas({ from: account, to, data });
  return client.send({
    from: account,
    to,
    data,
    gasLimit: gasLimit + gasLimit / 5n,
    maxFeePerGas: fee.maxFeePerGas,
    maxPriorityFeePerGas: fee.maxPriorityFeePerGas,
  });
}

function draft(
  label: string,
  priority: number,
  to: string,
  fragment: AbiFunction,
  args: unknown[],
): TxDraft {
  return {
    label,
    priority,
    execute: async ({ client, account }) => submit(client, account, to, fragment, args, await client.getFeeQuote()),
  };
}

export function approveDraft(token: string, vault: string, amount: bigint): TxDraft {
  return draft("Approve aUSD", 50, token, erc20.approve, [vault, amount]);
}

export function depositDraft(vault: string, amount: bigint, proof: string[]): TxDraft {
  return draft("Deposit", 40, vault, vaultAbi.deposit, [amount, proof]);
}

export function withdrawDraft(vault: string, amount: bigint): TxDraft {
  return draft("Withdraw", 70, vault, vaultAbi.withdraw, [amount]);
}

export function rootDraft(vault: string, root: string): TxDraft {
  return draft("Publish allowlist root", 80, vault, vaultAbi.setAllowlistRoot, [root]);
}

export function pauseDraft(vault: string, paused: boolean): TxDraft {
  return draft(paused ? "Pause vault" : "Resume vault", 90, vault, vaultAbi.setPaused, [paused]);
}
