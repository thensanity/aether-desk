import { AbiCoder, id } from "ethers";
import { toChecksumAddress } from "../evm/address";
import type { RawLog, VaultLog } from "../types";

const DEPOSITED = id("Deposited(address,uint256)").toLowerCase();
const WITHDRAWN = id("Withdrawn(address,uint256)").toLowerCase();

export function decodeVaultLog(log: RawLog): VaultLog | null {
  const topic = log.topics[0]?.toLowerCase();
  if (topic !== DEPOSITED && topic !== WITHDRAWN) return null;
  const accountTopic = log.topics[1];
  if (!accountTopic || accountTopic.length < 42) return null;
  const [amount] = AbiCoder.defaultAbiCoder().decode(["uint256"], log.data);
  return {
    kind: topic === DEPOSITED ? "Deposited" : "Withdrawn",
    account: toChecksumAddress(`0x${accountTopic.slice(-40)}`),
    amount: amount as bigint,
    transactionHash: log.transactionHash,
    blockNumber: log.blockNumber,
  };
}
