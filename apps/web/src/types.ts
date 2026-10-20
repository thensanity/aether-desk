export type ClientKind = "ethers" | "web3";

export interface AppConfig {
  chainId: number;
  rpcUrl: string;
  client: ClientKind;
}

export interface FeeQuote {
  baseFeePerGas: bigint | null;
  maxPriorityFeePerGas: bigint;
  maxFeePerGas: bigint;
  gasPrice: bigint;
}

export interface RawLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: number;
  transactionHash: string;
}

export interface LogFilter {
  address: string;
  fromBlock: number;
  toBlock: number | "latest";
}

export interface CallRequest {
  to: string;
  data: string;
}

export interface SendRequest {
  from: string;
  to: string;
  data?: string;
  value?: bigint;
  gasLimit?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
}

export interface SentTransaction {
  hash: string;
  wait: () => Promise<{ status: number; blockNumber: number }>;
}

export interface AbiInput {
  name: string;
  type: string;
}

export interface AbiFunction {
  name: string;
  type: "function";
  stateMutability: "view" | "pure" | "nonpayable" | "payable";
  inputs: AbiInput[];
  outputs: AbiInput[];
}

export interface ChainClient {
  readonly kind: ClientKind;
  getChainId(): Promise<number>;
  getBlockNumber(): Promise<number>;
  getBalance(address: string): Promise<bigint>;
  getTransactionCount(address: string): Promise<number>;
  getFeeQuote(): Promise<FeeQuote>;
  getAccounts(): Promise<string[]>;
  call(tx: CallRequest): Promise<string>;
  estimateGas(tx: SendRequest): Promise<bigint>;
  send(tx: SendRequest): Promise<SentTransaction>;
  getLogs(filter: LogFilter): Promise<RawLog[]>;
  encode(fragment: AbiFunction, args: unknown[]): string;
  decode(fragment: AbiFunction, data: string): unknown[];
}

export interface Deployment {
  token: string;
  vault: string;
  allowlistRoot: string;
}

export interface Portfolio {
  symbol: string;
  decimals: number;
  walletBalance: bigint;
  allowance: bigint;
  vaultBalance: bigint;
  totalAssets: bigint;
  owner: string;
  paused: boolean;
  allowlistRoot: string;
  asset: string;
}

export interface VaultLog {
  kind: "Deposited" | "Withdrawn";
  account: string;
  amount: bigint;
  transactionHash: string;
  blockNumber: number;
}

export type TxStatus = "queued" | "submitted" | "mined" | "failed";

export interface TxView {
  id: string;
  label: string;
  priority: number;
  seq: number;
  status: TxStatus;
  hash?: string;
  error?: string;
}
