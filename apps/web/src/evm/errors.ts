import { AbiCoder, id } from "ethers";

const LABELS: Record<string, string> = {
  "NotOwner()": "Only the vault owner can do that.",
  "Paused()": "The vault is paused.",
  "ZeroAmount()": "Amount must be greater than zero.",
  "ZeroAddress()": "The zero address is not allowed.",
  "InsufficientBalance()": "Balance is too low for that amount.",
  "InsufficientAllowance()": "Token allowance is too low. Approve the vault first.",
  "NotAllowlisted()": "This account is not on the vault allowlist.",
  "TransferFailed()": "The token refused the transfer.",
  "Reentrancy()": "The vault rejected a re-entrant call.",
};

const SELECTORS = Object.fromEntries(
  Object.keys(LABELS).map((signature) => [id(signature).slice(0, 10).toLowerCase(), LABELS[signature]]),
);

export function decodeRevert(data: string): string | null {
  if (!data || !data.startsWith("0x") || data.length < 10) return null;
  const selector = data.slice(0, 10).toLowerCase();
  const known = SELECTORS[selector];
  if (known) return known;
  if (selector === "0x08c379a0" && data.length >= 10) {
    try {
      const [reason] = AbiCoder.defaultAbiCoder().decode(["string"], `0x${data.slice(10)}`);
      return String(reason);
    } catch {
      return null;
    }
  }
  return null;
}

function hexData(value: unknown): string | null {
  return typeof value === "string" && /^0x[0-9a-fA-F]{8,}$/.test(value) ? value : null;
}

/** Walks ethers and web3.js wrappers. web3 puts the revert payload on `cause.data`, not `message`. */
function extractData(err: unknown, depth = 0): string | null {
  if (depth > 6 || err == null) return null;
  const direct = hexData(err);
  if (direct) return direct;
  if (typeof err !== "object") return null;
  const record = err as Record<string, unknown>;
  const data = hexData(record.data) ?? extractData(record.data, depth + 1);
  if (data) return data;
  for (const key of ["cause", "error", "innerError", "originalError"]) {
    const nested = extractData(record[key], depth + 1);
    if (nested) return nested;
  }
  if (err instanceof Error) return hexData(err.message.match(/0x[0-9a-fA-F]{8,}/)?.[0]);
  return null;
}

export function humanize(err: unknown): string {
  const decoded = decodeRevert(extractData(err) ?? "");
  if (decoded) return decoded;
  const message = err instanceof Error ? err.message : String(err);
  if (/user rejected|user denied|4001/i.test(message)) return "The wallet rejected the request.";
  if (/insufficient funds/i.test(message)) return "The account does not have enough ETH for gas.";
  if (/chain mismatch|wrong network/i.test(message)) return "The wallet is on a different network.";
  const first = message.split("\n").map((line) => line.trim()).find(Boolean);
  return first || "The request failed.";
}
