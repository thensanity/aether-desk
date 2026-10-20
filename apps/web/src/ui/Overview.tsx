import { useState } from "react";
import { deploymentFor, getConfig } from "../config";
import { createChainClient } from "../chain/factory";
import { httpTransport } from "../chain/http";
import { chainLabel, getInjected } from "../chain/wallet";
import { formatGwei, formatToken, shortAddress } from "../evm/format";
import { useChain } from "../state";
import type { ClientKind } from "../types";
import { CopyButton } from "./CopyButton";

interface Probe {
  kind: ClientKind;
  block: number;
  ms: number;
}

export function Overview() {
  const chain = useChain();
  const deployment = chain.chainId === null ? null : deploymentFor(chain.chainId);
  const [probe, setProbe] = useState<Probe[]>([]);
  const [probing, setProbing] = useState(false);
  const [probeError, setProbeError] = useState<string | null>(null);
  const base = chain.fee?.baseFeePerGas;

  async function runProbe() {
    setProbing(true);
    setProbeError(null);
    try {
      const transport = getInjected() ?? httpTransport(getConfig().rpcUrl);
      const results: Probe[] = [];
      for (const kind of ["ethers", "web3"] as const) {
        const client = await createChainClient(kind, transport);
        const started = performance.now();
        const block = await client.getBlockNumber();
        results.push({ kind, block, ms: Math.round(performance.now() - started) });
      }
      setProbe(results);
    } catch (err) {
      setProbeError(err instanceof Error ? err.message : "Probe failed");
    } finally {
      setProbing(false);
    }
  }

  return (
    <>
      <section className="band" aria-label="Network summary">
        <article className="metric">
          <span className="label">Ether</span>
          <strong>{chain.ethBalance === null ? "—" : formatToken(chain.ethBalance)}</strong>
          <em>{chain.account ? shortAddress(chain.account) : "Read only"}</em>
        </article>
        <article className="metric">
          <span className="label">Base fee</span>
          <strong>{base === null || base === undefined ? "—" : formatGwei(base)}</strong>
          <em>Smoothed {chain.smoothedBase === null ? "—" : formatGwei(chain.smoothedBase)}</em>
        </article>
        <article className="metric">
          <span className="label">Max fee</span>
          <strong>{chain.fee ? formatGwei(chain.fee.maxFeePerGas) : "—"}</strong>
          <em>Tip {chain.fee ? formatGwei(chain.fee.maxPriorityFeePerGas) : "—"}</em>
        </article>
        <article className="metric">
          <span className="label">Transport</span>
          <strong>{chain.kind}</strong>
          <em>{chain.chainId === null ? "No chain" : chainLabel(chain.chainId)}</em>
        </article>
      </section>

      <div className="grid">
        <section className="card">
          <h2>Contracts on this chain</h2>
          {chain.chainId === null ? (
            <p className="lede">Waiting for the chain.</p>
          ) : deployment ? (
            <div className="stack">
              <div className="split">
                <div>
                  <span className="label">aUSD</span>
                  <div className="mono">{deployment.token}</div>
                </div>
                <CopyButton value={deployment.token} />
              </div>
              <div className="split">
                <div>
                  <span className="label">Savings vault</span>
                  <div className="mono">{deployment.vault}</div>
                </div>
                <CopyButton value={deployment.vault} />
              </div>
              <p className="lede">
                Addresses come from the last deploy script. A zero address means this chain has not been written yet.
              </p>
            </div>
          ) : (
            <div className="stack">
              <p className="lede">
                Nothing is deployed for chain {chain.chainId}. Start Hardhat, deploy, and reload. The desk keeps working as a fee
                and wallet console either way.
              </p>
              <pre className="mono">{`npm run chain\nnpm run deploy`}</pre>
            </div>
          )}
        </section>

        <section className="card">
          <h2>Both libraries, same block</h2>
          <p className="lede">
            The buttons in the rail swap the live transport. This probe loads each library and reads the head block through it.
          </p>
          <button type="button" className="btn" onClick={() => void runProbe()} disabled={probing}>
            {probing ? "Reading…" : "Probe transports"}
          </button>
          {probeError ? <p className="bad">{probeError}</p> : null}
          {probe.length > 0 ? (
            <div className="probe" style={{ marginTop: 16 }}>
              {probe.map((sample) => (
                <article key={sample.kind}>
                  <span className="label">{sample.kind}</span>
                  <div className="figure">{sample.block}</div>
                  <div className="muted">{sample.ms} ms</div>
                </article>
              ))}
            </div>
          ) : null}
          {probe.length === 2 && probe[0].block === probe[1].block ? (
            <p className="good">Both transports agree on the head block.</p>
          ) : null}
        </section>
      </div>
    </>
  );
}
