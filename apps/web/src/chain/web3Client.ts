import { Web3, type AbiFunctionFragment } from "web3";
import { suggestFees } from "../evm/fees";
import type {
  AbiFunction,
  CallRequest,
  ChainClient,
  FeeQuote,
  LogFilter,
  RawLog,
  SendRequest,
  SentTransaction,
} from "../types";

function asBigint(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  if (typeof value === "string" && value.length > 0) return BigInt(value);
  throw new Error("Expected an integer from web3.js");
}

function asNumber(value: unknown): number {
  return Number(asBigint(value));
}

function asAddressList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function toAbi(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(toAbi);
  return value;
}

function asHex(value: bigint | undefined): string | undefined {
  if (value === undefined) return undefined;
  return `0x${value.toString(16)}`;
}

/** web3.js v4 transport. Calls are encoded with eth.abi and submitted through eth.sendTransaction. */
export class Web3ChainClient implements ChainClient {
  readonly kind = "web3" as const;
  private readonly web3: Web3;

  constructor(private readonly ethereum: Eip1193Provider) {
    this.web3 = new Web3(ethereum as unknown as Web3["provider"]);
  }

  async getChainId(): Promise<number> {
    return asNumber(await this.web3.eth.getChainId());
  }

  async getBlockNumber(): Promise<number> {
    return asNumber(await this.web3.eth.getBlockNumber());
  }

  async getBalance(address: string): Promise<bigint> {
    return asBigint(await this.web3.eth.getBalance(address));
  }

  async getTransactionCount(address: string): Promise<number> {
    return asNumber(await this.web3.eth.getTransactionCount(address, "pending"));
  }

  async getFeeQuote(): Promise<FeeQuote> {
    const block = await this.web3.eth.getBlock("latest");
    const gasPrice = asBigint(await this.web3.eth.getGasPrice());
    const base = block && block.baseFeePerGas != null ? asBigint(block.baseFeePerGas) : gasPrice;
    let tip: bigint | null = null;
    try {
      tip = asBigint(await this.ethereum.request({ method: "eth_maxPriorityFeePerGas" }));
    } catch {
      tip = null;
    }
    return suggestFees(base, tip);
  }

  async getAccounts(): Promise<string[]> {
    const accounts = await this.web3.eth.getAccounts();
    return asAddressList(accounts);
  }

  async call(tx: CallRequest): Promise<string> {
    const result = await this.web3.eth.call({ to: tx.to, data: tx.data });
    return String(result);
  }

  async estimateGas(tx: SendRequest): Promise<bigint> {
    return asBigint(
      await this.web3.eth.estimateGas({
        from: tx.from,
        to: tx.to,
        data: tx.data,
        value: asHex(tx.value),
      }),
    );
  }

  async send(tx: SendRequest): Promise<SentTransaction> {
    const promi = this.web3.eth.sendTransaction({
      from: tx.from,
      to: tx.to,
      data: tx.data,
      value: asHex(tx.value),
      gas: asHex(tx.gasLimit),
      maxFeePerGas: asHex(tx.maxFeePerGas),
      maxPriorityFeePerGas: asHex(tx.maxPriorityFeePerGas),
    });
    const hash = await new Promise<string>((resolve, reject) => {
      promi.once("transactionHash", (value: string) => resolve(value));
      promi.once("error", (err: unknown) => reject(err instanceof Error ? err : new Error(String(err))));
    });
    return {
      hash,
      wait: async () => {
        const receipt = await promi;
        return {
          status: asNumber(receipt.status),
          blockNumber: asNumber(receipt.blockNumber),
        };
      },
    };
  }

  async getLogs(filter: LogFilter): Promise<RawLog[]> {
    const logs = await this.web3.eth.getPastLogs({
      address: filter.address,
      fromBlock: filter.fromBlock,
      toBlock: filter.toBlock,
    });
    const normalized: RawLog[] = [];
    for (const log of logs) {
      if (typeof log === "string" || log.blockNumber == null || !log.transactionHash) continue;
      normalized.push({
        address: String(log.address ?? filter.address),
        topics: (log.topics ?? []).map((topic) => String(topic)),
        data: String(log.data ?? "0x"),
        blockNumber: asNumber(log.blockNumber),
        transactionHash: String(log.transactionHash),
      });
    }
    return normalized;
  }

  encode(fragment: AbiFunction, args: unknown[]): string {
    return this.web3.eth.abi.encodeFunctionCall(
      fragment as unknown as AbiFunctionFragment,
      args.map(toAbi) as string[],
    );
  }

  decode(fragment: AbiFunction, data: string): unknown[] {
    const types = fragment.outputs.map((output) => output.type);
    if (types.length === 0) return [];
    const decoded = this.web3.eth.abi.decodeParameters(types, data);
    return types.map((_, index) => decoded[index]);
  }
}
