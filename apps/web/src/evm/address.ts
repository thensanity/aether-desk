import { keccak256 } from "ethers";

/** EIP-55 checksum. The hash is over the lowercase hex characters, not the 20 raw bytes. */
export function toChecksumAddress(address: string): string {
  const raw = address.toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{40}$/.test(raw)) throw new Error("Invalid Ethereum address");
  const hash = keccak256(new TextEncoder().encode(raw)).slice(2);
  let out = "0x";
  for (let i = 0; i < 40; i += 1) {
    out += Number.parseInt(hash[i], 16) >= 8 ? raw[i].toUpperCase() : raw[i];
  }
  return out;
}

export function sameAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
