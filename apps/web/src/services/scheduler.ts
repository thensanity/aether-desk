import { Heap } from "../ds/heap";
import { humanize } from "../evm/errors";
import type { ChainClient, SentTransaction, TxStatus, TxView } from "../types";

export interface TxDraft {
  label: string;
  priority: number;
  execute: (ctx: { client: ChainClient; account: string }) => Promise<SentTransaction>;
}

interface TxJob extends TxView {
  execute: TxDraft["execute"];
}

/**
 * Serial nonce-safe sender.
 * Jobs submitted in the same turn are ordered with a binary heap (priority, then FIFO)
 * before the first one hits the wallet. Each send is awaited only until the node accepts
 * it, so the next pending nonce is visible without waiting for a block.
 */
export class TxScheduler {
  private readonly heap = new Heap<TxJob>((a, b) => {
    if (a.priority !== b.priority) return a.priority > b.priority;
    return a.seq < b.seq;
  });

  private items: TxJob[] = [];
  private seq = 0;
  private pumping = false;
  private scheduled = false;
  private readonly waiters: Array<() => void> = [];

  constructor(
    private readonly deps: {
      getClient: () => ChainClient | null;
      getAccount: () => string | null;
      onUpdate: () => void;
    },
  ) {}

  list(): TxView[] {
    return this.items.map((job) => ({
      id: job.id,
      label: job.label,
      priority: job.priority,
      seq: job.seq,
      status: job.status,
      hash: job.hash,
      error: job.error,
    }));
  }

  enqueue(draft: TxDraft): string {
    const job: TxJob = {
      id: crypto.randomUUID(),
      label: draft.label,
      priority: draft.priority,
      seq: this.seq,
      status: "queued",
      execute: draft.execute,
    };
    this.seq += 1;
    this.items = [job, ...this.items].slice(0, 40);
    this.heap.push(job);
    this.deps.onUpdate();
    this.kick();
    return job.id;
  }

  idle(): Promise<void> {
    if (!this.pumping && !this.scheduled && this.heap.size === 0) return Promise.resolve();
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  private kick(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      void this.pump();
    });
  }

  private async pump(): Promise<void> {
    if (this.pumping) return;
    this.pumping = true;
    try {
      let job = this.heap.pop();
      while (job) {
        await this.run(job);
        job = this.heap.pop();
      }
    } finally {
      this.pumping = false;
      if (this.heap.size > 0) this.kick();
      else this.settle();
    }
  }

  private settle(): void {
    const pending = this.waiters.splice(0);
    for (const resolve of pending) resolve();
  }

  private patch(id: string, status: TxStatus, extra: Partial<Pick<TxJob, "hash" | "error">> = {}): void {
    this.items = this.items.map((job) => (job.id === id ? { ...job, status, ...extra } : job));
    this.deps.onUpdate();
  }

  private async run(job: TxJob): Promise<void> {
    const client = this.deps.getClient();
    const account = this.deps.getAccount();
    if (!client || !account) {
      this.patch(job.id, "failed", { error: "Connect a wallet before sending a transaction." });
      return;
    }
    try {
      const sent = await job.execute({ client, account });
      this.patch(job.id, "submitted", { hash: sent.hash });
      void sent.wait().then(
        (receipt) => {
          this.patch(job.id, receipt.status === 1 ? "mined" : "failed", {
            hash: sent.hash,
            error: receipt.status === 1 ? undefined : "The transaction reverted.",
          });
        },
        (err: unknown) => {
          this.patch(job.id, "failed", { hash: sent.hash, error: humanize(err) });
        },
      );
    } catch (err) {
      this.patch(job.id, "failed", { error: humanize(err) });
    }
  }
}
