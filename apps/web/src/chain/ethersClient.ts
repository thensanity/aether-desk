import { BrowserProvider, Interface, type Eip1193Provider as EthersProvider } from "ethers";
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

function asAddressList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

/** ethers v6 transport. Encoding goes through Interface; signing goes through BrowserProvider. */
export class EthersChainClient implements ChainClient {
  readonly kind = "ethers" as const;

  constructor(private readonly ethereum: Eip1193Provider) {}

  private provider(): BrowserProvider {
    return new BrowserProvider(this.ethereum as EthersProvider);
  }

  async getChainId(): Promise<number> {
    return Number((await this.provider().getNetwork()).chainId);
  }

  async getBlockNumber(): Promise<number> {
    return this.provider().getBlockNumber();
  }

  async getBalance(address: string): Promise<bigint> {
    return this.provider().getBalance(address);
  }

  async getTransactionCount(address: string): Promise<number> {
    return this.provider().getTransactionCount(address, "pending");
  }

  async getFeeQuote(): Promise<FeeQuote> {
    const provider = this.provider();
    const [fee, block] = await Promise.all([provider.getFeeData(), provider.getBlock("latest")]);
    const base = block?.baseFeePerGas ?? fee.gasPrice ?? null;
    return suggestFees(base, fee.maxPriorityFeePerGas);
  }

  async getAccounts(): Promise<string[]> {
    return asAddressList(await this.ethereum.request({ method: "eth_accounts" }));
  }

  async call(tx: CallRequest): Promise<string> {
    return this.provider().call({ to: tx.to, data: tx.data });
  }

  async estimateGas(tx: SendRequest): Promise<bigint> {
    return this.provider().estimateGas({
      from: tx.from,
      to: tx.to,
      data: tx.data,
      value: tx.value,
    });
  }

  async send(tx: SendRequest): Promise<SentTransaction> {
    const signer = await this.provider().getSigner(tx.from);
    const response = await signer.sendTransaction({
      to: tx.to,
      data: tx.data,
      value: tx.value,
      gasLimit: tx.gasLimit,
      maxFeePerGas: tx.maxFeePerGas,
      maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
    });
    return {
      hash: response.hash,
      wait: async () => {
        const receipt = await response.wait();
        return {
          status: Number(receipt?.status ?? 0),
          blockNumber: Number(receipt?.blockNumber ?? 0),
        };
      },
    };
  }

  async getLogs(filter: LogFilter): Promise<RawLog[]> {
    const logs = await this.provider().getLogs({
      address: filter.address,
      fromBlock: filter.fromBlock,
      toBlock: filter.toBlock,
    });
    return logs.map((log) => ({
      address: log.address,
      topics: [...log.topics],
      data: log.data,
      blockNumber: Number(log.blockNumber),
      transactionHash: log.transactionHash,
    }));
  }

  encode(fragment: AbiFunction, args: unknown[]): string {
    return new Interface([fragment]).encodeFunctionData(fragment.name, args);
  }

  decode(fragment: AbiFunction, data: string): unknown[] {
    return [...new Interface([fragment]).decodeFunctionResult(fragment.name, data)];
  }
}
