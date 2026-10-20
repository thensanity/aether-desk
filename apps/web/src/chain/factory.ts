import { cachedTransport } from "./http";
import type { ChainClient, ClientKind } from "../types";

export async function createChainClient(kind: ClientKind, ethereum: Eip1193Provider): Promise<ChainClient> {
  const wrapped = cachedTransport(ethereum);
  if (kind === "ethers") {
    const { EthersChainClient } = await import("./ethersClient");
    return new EthersChainClient(wrapped);
  }
  const { Web3ChainClient } = await import("./web3Client");
  return new Web3ChainClient(wrapped);
}
