import type { ClientKind, AppConfig } from "./types";
import deployments from "./generated/deployments.json";
import type { Deployment } from "./types";

const ZERO = "0x0000000000000000000000000000000000000000";

const defaults: AppConfig = {
  chainId: Number(import.meta.env.VITE_CHAIN_ID ?? 31337),
  rpcUrl: import.meta.env.VITE_RPC_URL ?? "http://127.0.0.1:8545",
  client: import.meta.env.VITE_CLIENT === "web3" ? "web3" : "ethers",
};

let current: AppConfig = defaults;

export function getConfig(): AppConfig {
  return current;
}

export function setConfig(next: Partial<AppConfig> & { chainId?: number; rpcUrl?: string; client?: string }): void {
  const client: ClientKind = next.client === "web3" ? "web3" : next.client === "ethers" ? "ethers" : current.client;
  current = {
    chainId: Number.isFinite(next.chainId) ? Number(next.chainId) : current.chainId,
    rpcUrl: typeof next.rpcUrl === "string" && next.rpcUrl.length > 0 ? next.rpcUrl : current.rpcUrl,
    client,
  };
}

export async function loadRuntimeConfig(): Promise<AppConfig> {
  try {
    const response = await fetch("/config.json", { cache: "no-store" });
    if (!response.ok) return current;
    const json = (await response.json()) as Partial<AppConfig>;
    setConfig(json);
  } catch {
    /* file missing in unusual hosts; build-time defaults still apply */
  }
  const stored = window.localStorage.getItem("aether.client");
  if (stored === "ethers" || stored === "web3") setConfig({ client: stored });
  return current;
}

export function lookupDeployment(table: Record<string, Deployment>, chainId: number): Deployment | null {
  const row = table[String(chainId)];
  if (!row || isZeroAddress(row.vault)) return null;
  return row;
}

export function deploymentFor(chainId: number): Deployment | null {
  return lookupDeployment(deployments as Record<string, Deployment>, chainId);
}

export function isZeroAddress(address: string): boolean {
  return address.toLowerCase() === ZERO;
}
