import { describe, expect, it } from "vitest";
import { TxScheduler, type TxDraft } from "./scheduler";
import type { ChainClient, TxView } from "../types";

const client = { kind: "ethers" } as ChainClient;
const account = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

function draft(label: string, priority: number, order: string[]): TxDraft {
  return {
    label,
    priority,
    execute: async () => {
      order.push(label);
      return { hash: `0x${label}`, wait: async () => ({ status: 1, blockNumber: 1 }) };
    },
  };
}

describe("TxScheduler", () => {
  it("sends a same-turn burst in priority order", async () => {
    const order: string[] = [];
    const scheduler = new TxScheduler({
      getClient: () => client,
      getAccount: () => account,
      onUpdate: () => undefined,
    });
    scheduler.enqueue(draft("deposit", 40, order));
    scheduler.enqueue(draft("withdraw", 70, order));
    await scheduler.idle();
    expect(order).toEqual(["withdraw", "deposit"]);
  });

  it("records a failure when nothing is connected", async () => {
    let views: TxView[] = [];
    const scheduler = new TxScheduler({
      getClient: () => null,
      getAccount: () => null,
      onUpdate: () => {
        views = scheduler.list();
      },
    });
    scheduler.enqueue({
      label: "Deposit",
      priority: 1,
      execute: async () => {
        throw new Error("should not send");
      },
    });
    await scheduler.idle();
    expect(views[0]?.status).toBe("failed");
    expect(views[0]?.error).toMatch(/Connect a wallet/);
  });
});
