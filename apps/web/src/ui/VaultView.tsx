import { useEffect, useState } from "react";
import { deploymentFor } from "../config";
import { sameAddress } from "../evm/address";
import { formatToken, parseToken } from "../evm/format";
import { quoteCost } from "../evm/fees";
import {
  approveDraft,
  depositDraft,
  pauseDraft,
  readAllowlisted,
  readPortfolio,
  withdrawDraft,
} from "../services/vaultService";
import { useChain } from "../state";
import type { Portfolio } from "../types";

export function VaultView() {
  const chain = useChain();
  const deployment = chain.chainId === null ? null : deploymentFor(chain.chainId);
  const [amount, setAmount] = useState("25");
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [onChainAllow, setOnChainAllow] = useState<boolean | null>(null);

  const decimals = portfolio?.decimals ?? 18;
  let parsed: bigint | null = null;
  let parseError: string | null = null;
  try {
    parsed = parseToken(amount, decimals);
  } catch (err) {
    parseError = err instanceof Error ? err.message : "Invalid amount";
  }

  const proof = chain.account ? chain.tree.getProof(chain.account) : null;
  const canWrite = chain.status === "ready" && chain.client !== null && deployment !== null;

  useEffect(() => {
    if (!chain.client || !chain.account || !deployment) {
      setPortfolio(null);
      setOnChainAllow(null);
      return;
    }
    let cancelled = false;
    const client = chain.client;
    const account = chain.account;
    const nextProof = chain.tree.getProof(account) ?? [];
    void readPortfolio(client, account, deployment.token, deployment.vault)
      .then((next) => {
        if (!cancelled) {
          setPortfolio(next);
          setLoadError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Could not read the vault");
      });
    void readAllowlisted(client, deployment.vault, account, nextProof)
      .then((allowed) => {
        if (!cancelled) setOnChainAllow(allowed);
      })
      .catch(() => {
        if (!cancelled) setOnChainAllow(null);
      });
    return () => {
      cancelled = true;
    };
  }, [chain.client, chain.account, chain.revision, chain.tree, deployment]);

  if (chain.chainId === null) {
    return (
      <section className="card">
        <h2>Vault</h2>
        <p className="lede">Waiting for the chain.</p>
      </section>
    );
  }

  if (!deployment) {
    return (
      <section className="card">
        <h2>Vault</h2>
        <p className="lede">Deploy the contracts to this chain before depositing. The command is `npm run deploy` against a running node.</p>
      </section>
    );
  }

  const needsApproval = portfolio !== null && parsed !== null && portfolio.allowance < parsed;
  const isOwner = portfolio !== null && chain.account !== null && sameAddress(portfolio.owner, chain.account);
  const feePreview =
    chain.fee && parsed !== null ? formatToken(quoteCost(120_000n, chain.fee.maxFeePerGas), 18, 5) : null;

  return (
    <div className="grid">
      <section className="card">
        <h2>Position</h2>
        {loadError ? <p className="bad">{loadError}</p> : null}
        <div className="kv">
          <span>Wallet</span>
          <strong>{portfolio ? `${formatToken(portfolio.walletBalance, decimals)} ${portfolio.symbol}` : "—"}</strong>
          <span>In vault</span>
          <strong>{portfolio ? `${formatToken(portfolio.vaultBalance, decimals)} ${portfolio.symbol}` : "—"}</strong>
          <span>Allowance</span>
          <strong>{portfolio ? formatToken(portfolio.allowance, decimals) : "—"}</strong>
          <span>Total assets</span>
          <strong>{portfolio ? formatToken(portfolio.totalAssets, decimals) : "—"}</strong>
          <span>Allowlist</span>
          <strong className={onChainAllow ? "good" : "warn"}>{onChainAllow === null ? "—" : onChainAllow ? "Included" : "Missing"}</strong>
        </div>
        {portfolio?.paused ? <p className="warn">The vault is paused. Deposits and withdrawals will revert.</p> : null}
      </section>

      <section className="card">
        <h2>Move funds</h2>
        <label className="field">
          <span className="label">Amount</span>
          <input value={amount} inputMode="decimal" onChange={(event) => setAmount(event.target.value)} />
        </label>
        {parseError ? <p className="bad">{parseError}</p> : null}
        <p className="muted">
          {proof
            ? "A local Merkle proof is attached to the deposit."
            : "This account has no local proof. Add it on the Allowlist page."}
          {feePreview ? ` An illustrative 120,000 gas at the current max fee is about ${feePreview} ETH.` : ""}
        </p>
        <div className="row">
          <button
            type="button"
            className="btn ghost"
            disabled={!canWrite || !needsApproval || parsed === null}
            onClick={() => chain.scheduler.enqueue(approveDraft(deployment.token, deployment.vault, parsed as bigint))}
          >
            Approve
          </button>
          <button
            type="button"
            className="btn"
            disabled={!canWrite || portfolio === null || parsed === null || !proof || needsApproval || portfolio.paused}
            onClick={() => chain.scheduler.enqueue(depositDraft(deployment.vault, parsed as bigint, proof ?? []))}
          >
            Deposit
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={!canWrite || portfolio === null || parsed === null || portfolio.paused}
            onClick={() => chain.scheduler.enqueue(withdrawDraft(deployment.vault, parsed as bigint))}
          >
            Withdraw
          </button>
        </div>
        {isOwner ? (
          <div className="row">
            <button
              type="button"
              className="btn ghost"
              onClick={() => chain.scheduler.enqueue(pauseDraft(deployment.vault, !portfolio.paused))}
            >
              {portfolio.paused ? "Resume vault" : "Pause vault"}
            </button>
          </div>
        ) : null}
        {chain.status === "readonly" ? <p className="muted">Connect a wallet to send transactions.</p> : null}
      </section>
    </div>
  );
}
