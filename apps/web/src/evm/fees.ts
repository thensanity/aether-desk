import type { FeeQuote } from "../types";

/** 1 gwei. Hardhat often reports a zero priority fee, which will not replace a stuck transaction. */
const DEFAULT_TIP = 1_000_000_000n;

/**
 * EIP-1559 headroom. A full block can move the base fee by 12.5%.
 * Doubling the latest base fee covers several busy blocks without asking the wallet to guess.
 */
export function suggestFees(baseFeePerGas: bigint | null, suggestedTip: bigint | null): FeeQuote {
  const tip = suggestedTip && suggestedTip > 0n ? suggestedTip : DEFAULT_TIP;
  const base = baseFeePerGas ?? 0n;
  return {
    baseFeePerGas,
    maxPriorityFeePerGas: tip,
    maxFeePerGas: base * 2n + tip,
    gasPrice: base + tip,
  };
}

/** Exponential moving average. alphaBps is the weight of the new sample, in basis points. */
export function ema(previous: bigint | null, sample: bigint, alphaBps = 2_000n): bigint {
  if (previous === null) return sample;
  if (alphaBps < 0n || alphaBps > 10_000n) throw new Error("alphaBps must be between 0 and 10000");
  return (previous * (10_000n - alphaBps) + sample * alphaBps) / 10_000n;
}

export function quoteCost(gasLimit: bigint, maxFeePerGas: bigint): bigint {
  return gasLimit * maxFeePerGas;
}
