import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DEMO_ALLOWLIST, MerkleTree } from "@aether/merkle";
import { deploymentFor, getConfig } from "./config";
import { createChainClient } from "./chain/factory";
import { httpTransport } from "./chain/http";
import { getInjected, switchNetwork } from "./chain/wallet";
import { RingBuffer } from "./ds/ring";
import { toChecksumAddress } from "./evm/address";
import { humanize } from "./evm/errors";
import { ema } from "./evm/fees";
import { decodeVaultLog } from "./services/logs";
import { TxScheduler } from "./services/scheduler";
import type { ChainClient, ClientKind, FeeQuote, VaultLog } from "./types";

export type SessionStatus = "idle" | "connecting" | "ready" | "wrong-network" | "readonly";

interface ChainState {
  status: SessionStatus;
  kind: ClientKind;
  account: string | null;
  chainId: number | null;
  blockNumber: number | null;
  ethBalance: bigint | null;
  fee: FeeQuote | null;
  smoothedBase: bigint | null;
  error: string | null;
  logs: VaultLog[];
  allowlist: string[];
  tree: MerkleTree;
  client: ChainClient | null;
  scheduler: TxScheduler;
  revision: number;
  expectedChainId: number;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  switchChain: () => Promise<void>;
  setKind: (kind: ClientKind) => Promise<void>;
  setAllowlist: (addresses: string[]) => void;
  clearError: () => void;
}

const ChainContext = createContext<ChainState | null>(null);

function loadAllowlist(): string[] {
  const raw = window.localStorage.getItem("aether.allowlist");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function ChainProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [kind, setKindState] = useState<ClientKind>(getConfig().client);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [blockNumber, setBlockNumber] = useState<number | null>(null);
  const [ethBalance, setEthBalance] = useState<bigint | null>(null);
  const [fee, setFee] = useState<FeeQuote | null>(null);
  const [smoothedBase, setSmoothedBase] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<VaultLog[]>([]);
  const [allowlist, setAllowlistState] = useState<string[]>(() => {
    const stored = loadAllowlist();
    return stored.length > 0 ? stored : [...DEMO_ALLOWLIST];
  });
  const [epoch, setEpoch] = useState(0);
  const [revision, setRevision] = useState(0);

  const clientRef = useRef<ChainClient | null>(null);
  const accountRef = useRef<string | null>(null);
  const kindRef = useRef<ClientKind>(kind);
  accountRef.current = account;
  kindRef.current = kind;

  const scheduler = useMemo(
    () =>
      new TxScheduler({
        getClient: () => clientRef.current,
        getAccount: () => accountRef.current,
        onUpdate: () => setRevision((value) => value + 1),
      }),
    [],
  );

  const tree = useMemo(() => {
    const valid: string[] = [];
    for (const address of allowlist) {
      try {
        valid.push(toChecksumAddress(address));
      } catch {
        /* a bad row in local storage should not take the console down */
      }
    }
    return new MerkleTree(valid);
  }, [allowlist]);

  const bind = useCallback(async (ethereum: Eip1193Provider, nextKind: ClientKind) => {
    const client = await createChainClient(nextKind, ethereum);
    clientRef.current = client;
    const [id, accounts] = await Promise.all([client.getChainId(), client.getAccounts()]);
    const nextAccount = accounts[0] ?? null;
    setChainId(id);
    setAccount(nextAccount);
    setKindState(nextKind);
    setEpoch((value) => value + 1);
    if (!nextAccount) setStatus("readonly");
    else setStatus(id === getConfig().chainId ? "ready" : "wrong-network");
  }, []);

  const bindReadonly = useCallback(async (nextKind: ClientKind) => {
    const client = await createChainClient(nextKind, httpTransport(getConfig().rpcUrl));
    clientRef.current = client;
    const id = await client.getChainId();
    setAccount(null);
    setEthBalance(null);
    setChainId(id);
    setKindState(nextKind);
    setEpoch((value) => value + 1);
    setStatus("readonly");
  }, []);

  useEffect(() => {
    let cancelled = false;
    const injected = getInjected();

    const boot = async () => {
      try {
        if (!injected) {
          await bindReadonly(kindRef.current);
          return;
        }
        const existing = (await injected.request({ method: "eth_accounts" })) as unknown;
        if (cancelled) return;
        const accounts = Array.isArray(existing) ? existing.filter((item): item is string => typeof item === "string") : [];
        if (accounts.length > 0) await bind(injected, kindRef.current);
        else await bindReadonly(kindRef.current);
      } catch (err) {
        if (!cancelled) {
          setError(humanize(err));
          setStatus("idle");
        }
      }
    };

    void boot();

    const onAccounts = (value: unknown) => {
      if (!injected) return;
      const accounts = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
      const next = accounts.length === 0 ? bindReadonly(kindRef.current) : bind(injected, kindRef.current);
      void next.catch((err: unknown) => setError(humanize(err)));
    };
    const onChain = () => {
      if (!injected) return;
      void bind(injected, kindRef.current).catch((err: unknown) => setError(humanize(err)));
    };

    injected?.on?.("accountsChanged", onAccounts);
    injected?.on?.("chainChanged", onChain);
    return () => {
      cancelled = true;
      injected?.removeListener?.("accountsChanged", onAccounts);
      injected?.removeListener?.("chainChanged", onChain);
    };
  }, [bind, bindReadonly]);

  useEffect(() => {
    if (epoch === 0) return;
    let cancelled = false;
    const poll = async () => {
      const active = clientRef.current;
      if (!active || cancelled) return;
      try {
        const [block, quote] = await Promise.all([active.getBlockNumber(), active.getFeeQuote()]);
        if (cancelled) return;
        setBlockNumber(block);
        setFee(quote);
        setSmoothedBase((previous) => ema(previous, quote.baseFeePerGas ?? quote.gasPrice));
        const who = accountRef.current;
        setEthBalance(who ? await active.getBalance(who) : null);
      } catch (err) {
        if (!cancelled) setError(humanize(err));
      }
    };
    void poll();
    const id = window.setInterval(() => void poll(), 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [epoch, account]);

  useEffect(() => {
    if (epoch === 0 || chainId === null) return;
    const deployment = deploymentFor(chainId);
    if (!deployment) {
      setLogs([]);
      return;
    }
    let cancelled = false;
    const seen = new Set<string>();
    const ring = new RingBuffer<VaultLog>(40);
    let cursor = 0;

    const pull = async () => {
      const active = clientRef.current;
      if (!active || cancelled) return;
      const latest = await active.getBlockNumber();
      const fromBlock = cursor === 0 ? Math.max(0, latest - 40) : Math.max(0, cursor - 2);
      if (fromBlock > latest) return;
      const raw = await active.getLogs({ address: deployment.vault, fromBlock, toBlock: latest });
      for (const log of raw) {
        const decoded = decodeVaultLog(log);
        if (!decoded) continue;
        const key = `${decoded.transactionHash}:${decoded.kind}:${decoded.account}`;
        if (seen.has(key)) continue;
        seen.add(key);
        ring.push(decoded);
      }
      cursor = latest + 1;
      if (!cancelled) setLogs(ring.toArray().reverse());
    };

    void pull().catch(() => undefined);
    const id = window.setInterval(() => void pull().catch(() => undefined), 6000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [epoch, chainId]);

  const connect = useCallback(async () => {
    setError(null);
    const injected = getInjected();
    if (!injected) {
      setError("No injected wallet found. Install MetaMask, Rabby, or another EIP-1193 wallet.");
      return;
    }
    setStatus("connecting");
    try {
      await injected.request({ method: "eth_requestAccounts" });
      await bind(injected, kindRef.current);
    } catch (err) {
      setError(humanize(err));
      if (clientRef.current) setStatus(accountRef.current ? "ready" : "readonly");
      else setStatus("idle");
    }
  }, [bind]);

  const disconnect = useCallback(async () => {
    const injected = getInjected();
    if (injected) {
      try {
        await injected.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] });
      } catch {
        /* Wallets that omit revoke keep the site permission. The console still drops the session. */
      }
    }
    try {
      await bindReadonly(kindRef.current);
    } catch (err) {
      setAccount(null);
      setStatus("idle");
      setError(humanize(err));
    }
  }, [bindReadonly]);

  const switchChain = useCallback(async () => {
    const injected = getInjected();
    if (!injected) {
      setError("Switch networks from a connected wallet.");
      return;
    }
    setError(null);
    try {
      const config = getConfig();
      await switchNetwork(injected, config.chainId, config.rpcUrl);
      await bind(injected, kindRef.current);
    } catch (err) {
      setError(humanize(err));
    }
  }, [bind]);

  const setKind = useCallback(
    async (next: ClientKind) => {
      window.localStorage.setItem("aether.client", next);
      const injected = getInjected();
      try {
        if (injected && accountRef.current) await bind(injected, next);
        else await bindReadonly(next);
      } catch (err) {
        setError(humanize(err));
      }
    },
    [bind, bindReadonly],
  );

  const setAllowlist = useCallback((addresses: string[]) => {
    setAllowlistState(addresses);
    window.localStorage.setItem("aether.allowlist", JSON.stringify(addresses));
  }, []);

  const value = useMemo<ChainState>(
    () => ({
      status,
      kind,
      account,
      chainId,
      blockNumber,
      ethBalance,
      fee,
      smoothedBase,
      error,
      logs,
      allowlist,
      tree,
      client: clientRef.current,
      scheduler,
      revision,
      expectedChainId: getConfig().chainId,
      connect,
      disconnect,
      switchChain,
      setKind,
      setAllowlist,
      clearError: () => setError(null),
    }),
    [
      status,
      kind,
      account,
      chainId,
      blockNumber,
      ethBalance,
      fee,
      smoothedBase,
      error,
      logs,
      allowlist,
      tree,
      scheduler,
      revision,
      epoch,
      connect,
      disconnect,
      switchChain,
      setKind,
      setAllowlist,
    ],
  );

  return <ChainContext.Provider value={value}>{children}</ChainContext.Provider>;
}

export function useChain(): ChainState {
  const value = useContext(ChainContext);
  if (!value) throw new Error("useChain must be used inside ChainProvider");
  return value;
}
