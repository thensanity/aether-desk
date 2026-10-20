import { useEffect, useState } from "react";
import { ZERO_ROOT } from "@aether/merkle";
import { deploymentFor } from "../config";
import { sameAddress, toChecksumAddress } from "../evm/address";
import { shortAddress } from "../evm/format";
import { readVaultConfig, rootDraft } from "../services/vaultService";
import { useChain } from "../state";
import { CopyButton } from "./CopyButton";

export function AllowlistView() {
  const chain = useChain();
  const [draft, setDraft] = useState(() => chain.allowlist.join("\n"));
  const [formError, setFormError] = useState<string | null>(null);
  const [chainRoot, setChainRoot] = useState<string | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  const deployment = chain.chainId === null ? null : deploymentFor(chain.chainId);
  const localRoot = chain.tree.root();
  const proof = chain.account ? chain.tree.getProof(chain.account) : null;
  const rootsDiffer = chainRoot !== null && chainRoot.toLowerCase() !== localRoot.toLowerCase();

  useEffect(() => {
    if (!chain.client || !deployment) {
      setChainRoot(null);
      setOwner(null);
      return;
    }
    let cancelled = false;
    void readVaultConfig(chain.client, deployment.vault)
      .then((config) => {
        if (cancelled) return;
        setChainRoot(config.allowlistRoot);
        setOwner(config.owner);
      })
      .catch(() => {
        if (!cancelled) {
          setChainRoot(null);
          setOwner(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [chain.client, chain.revision, deployment]);

  function save() {
    const rows = draft
      .split(/\s+/)
      .map((row) => row.trim())
      .filter(Boolean);
    const next: string[] = [];
    for (const row of rows) {
      try {
        next.push(toChecksumAddress(row));
      } catch {
        setFormError(`${row} is not an Ethereum address.`);
        return;
      }
    }
    if (next.length === 0) {
      setFormError("Add at least one address, or the published root would open the vault.");
      return;
    }
    setFormError(null);
    chain.setAllowlist(next);
  }

  const isOwner = owner !== null && chain.account !== null && sameAddress(owner, chain.account);

  return (
    <div className="grid">
      <section className="card">
        <h2>Local tree</h2>
        <p className="lede">
          Leaves are double-keccak hashes of abi.encode(address), then paired in sorted order. The same module builds the
          proof here and the root in the deploy script.
        </p>
        <label className="field">
          <span className="label">Addresses</span>
          <textarea value={draft} spellCheck={false} onChange={(event) => setDraft(event.target.value)} />
        </label>
        {formError ? <p className="bad">{formError}</p> : null}
        <div className="row">
          <button type="button" className="btn" onClick={save}>
            Build tree
          </button>
          <span className="muted">{chain.tree.addresses.length} leaves</span>
        </div>
      </section>

      <section className="card stack">
        <h2>Root</h2>
        <div>
          <span className="label">Local</span>
          <div className="mono">{localRoot}</div>
        </div>
        <div>
          <span className="label">On chain</span>
          <div className="mono">{chainRoot ?? "—"}</div>
        </div>
        {chainRoot === null ? (
          <p className="muted">The vault root is not loaded yet.</p>
        ) : rootsDiffer ? (
          <p className="warn">The local root does not match the vault. Publishing it replaces who can deposit.</p>
        ) : (
          <p className="good">Local root matches the vault.</p>
        )}
        {chainRoot === ZERO_ROOT ? <p className="warn">The on-chain root is zero, so deposits are public.</p> : null}
        {chain.account ? (
          <div>
            <span className="label">Your proof</span>
            <div className="mono">{proof ? `${proof.length} hashes` : "Not in the local tree"}</div>
            {proof ? <CopyButton value={JSON.stringify(proof)} /> : null}
          </div>
        ) : (
          <p className="muted">Connect a wallet to preview its proof.</p>
        )}
        {deployment && isOwner ? (
          <button
            type="button"
            className="btn"
            disabled={chain.status !== "ready" || localRoot === ZERO_ROOT}
            onClick={() => chain.scheduler.enqueue(rootDraft(deployment.vault, localRoot))}
          >
            Publish root
          </button>
        ) : (
          <p className="muted">
            Owner {owner ? shortAddress(owner) : "—"} can publish. A zero root would make deposits public.
          </p>
        )}
      </section>
    </div>
  );
}
