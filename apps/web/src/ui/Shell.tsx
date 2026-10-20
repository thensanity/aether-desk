import { NavLink } from "react-router-dom";
import { chainLabel } from "../chain/wallet";
import { shortAddress } from "../evm/format";
import { useChain } from "../state";
import type { ClientKind } from "../types";

const LINKS = [
  ["/", "Overview"],
  ["/vault", "Vault"],
  ["/allowlist", "Allowlist"],
  ["/activity", "Activity"],
] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const chain = useChain();
  const statusClass =
    chain.status === "ready" ? "status ready" : chain.status === "wrong-network" ? "status warn" : "status";

  return (
    <div className="app">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <aside className="rail">
        <div className="brand">
          <strong>Aether</strong>
          <span>Desk for Ethereum vault operations. One interface, two transports.</span>
        </div>
        <nav className="nav" aria-label="Primary">
          {LINKS.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="rail-foot">
          <span className="label">Transport</span>
          <div className="transport" role="group" aria-label="Chain library">
            {(["ethers", "web3"] as ClientKind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                className={chain.kind === kind ? "active" : ""}
                aria-pressed={chain.kind === kind}
                onClick={() => void chain.setKind(kind)}
              >
                {kind}
              </button>
            ))}
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="top">
          <div>
            <p className="eyebrow">Operations console</p>
            <h1>Aether Desk</h1>
          </div>
          <div className="top-actions">
            <span className={statusClass}>
              {chain.chainId === null ? "connecting" : chainLabel(chain.chainId)}
              {chain.blockNumber !== null ? ` · ${chain.blockNumber}` : ""}
            </span>
            {chain.account ? <span className="pill">{shortAddress(chain.account)}</span> : null}
            {chain.account ? (
              <button type="button" className="btn ghost" onClick={() => void chain.disconnect()}>
                Disconnect
              </button>
            ) : (
              <button type="button" className="btn" onClick={() => void chain.connect()} disabled={chain.status === "connecting"}>
                {chain.status === "connecting" ? "Waiting…" : "Connect wallet"}
              </button>
            )}
          </div>
        </header>
        {chain.error ? (
          <div className="banner" role="alert">
            <p>{chain.error}</p>
            <button type="button" className="btn ghost tiny" onClick={chain.clearError}>
              Dismiss
            </button>
          </div>
        ) : null}
        {chain.status === "wrong-network" ? (
          <div className="banner quiet">
            <p>
              The wallet is on chain {chain.chainId}. This desk expects chain {chain.expectedChainId}.
            </p>
            <button type="button" className="btn tiny" onClick={() => void chain.switchChain()}>
              Switch network
            </button>
          </div>
        ) : null}
        <main id="main">{children}</main>
      </div>
    </div>
  );
}
