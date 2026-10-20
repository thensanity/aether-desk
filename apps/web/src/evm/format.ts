const WHOLE = /^\d+$/;
const DECIMAL = /^(\d+)(?:\.(\d+))?$/;

export function formatToken(value: bigint, decimals = 18, fraction = 4): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const scale = 10n ** BigInt(decimals);
  const whole = abs / scale;
  const remainder = abs % scale;
  let text = whole.toString();
  if (fraction > 0 && decimals > 0) {
    const digits = remainder.toString().padStart(decimals, "0").slice(0, fraction).replace(/0+$/, "");
    if (digits.length > 0) text = `${text}.${digits}`;
  }
  return negative ? `-${text}` : text;
}

export function parseToken(input: string, decimals = 18): bigint {
  const trimmed = input.trim();
  const match = DECIMAL.exec(trimmed);
  if (!match || trimmed.startsWith("+")) throw new Error("Enter a positive amount");
  const whole = match[1];
  const frac = match[2] ?? "";
  if (!WHOLE.test(whole)) throw new Error("Enter a positive amount");
  if (frac.length > decimals) throw new Error(`Use at most ${decimals} decimal places`);
  const padded = frac.padEnd(decimals, "0");
  return BigInt(whole) * 10n ** BigInt(decimals) + (padded.length > 0 ? BigInt(padded) : 0n);
}

export function formatGwei(wei: bigint): string {
  return `${formatToken(wei, 9, 3)} gwei`;
}

export function shortAddress(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function hexChainId(chainId: number): string {
  return `0x${chainId.toString(16)}`;
}
