import { formatToken, shortAddress } from "../evm/format";
import { useChain } from "../state";

const STATUS_CLASS = {
  queued: "muted",
  submitted: "warn",
  mined: "good",
  failed: "bad",
} as const;

export function ActivityView() {
  const chain = useChain();
  const jobs = chain.scheduler.list();

  return (
    <div className="grid">
      <section className="card">
        <h2>Submission queue</h2>
        <p className="lede">
          A same-turn burst is ordered by a binary heap: pause and withdraw outrank approval, which outranks deposit.
          Sends wait until the node accepts the transaction, then the next nonce can go out.
        </p>
        {jobs.length === 0 ? (
          <p className="muted">No transactions from this session yet.</p>
        ) : (
          <ul className="list">
            {jobs.map((job) => (
              <li key={job.id}>
                <strong>{job.label}</strong>
                <span className="mono">{job.hash ? shortAddress(job.hash) : job.error ?? "Waiting for the wallet"}</span>
                <span className={STATUS_CLASS[job.status]}>{job.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card">
        <h2>Vault logs</h2>
        <p className="lede">Decoded from Deposited and Withdrawn. The poll overlaps two blocks so a minor reorg is not missed.</p>
        {chain.logs.length === 0 ? (
          <p className="muted">No vault events in the recent window.</p>
        ) : (
          <ul className="list">
            {chain.logs.map((log) => (
              <li key={`${log.transactionHash}:${log.kind}:${log.account}`}>
                <strong>{log.kind}</strong>
                <span>
                  {formatToken(log.amount)} · {shortAddress(log.account)}
                </span>
                <span className="mono">{log.blockNumber}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
