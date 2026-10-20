import { AbiCoder, concat, getAddress, getBytes, keccak256 } from "ethers";

/** Matches an unset Solidity bytes32. The vault treats this root as an open allowlist. */
export const ZERO_ROOT = `0x${"00".repeat(32)}`;

/**
 * Hardhat's first three default accounts. The deploy script mints test aUSD to them
 * and seals the vault with a tree over this list. The key for account 0 is public
 * Hardhat documentation, and it is only useful on a local chain.
 */
export const DEMO_ALLOWLIST = [
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
];

/**
 * OpenZeppelin-style double hash. abi.encode(address) is a 32-byte word, so the
 * leaf cannot be confused with an internal pair hash (second-preimage resistance).
 */
export function hashLeaf(address) {
  const encoded = AbiCoder.defaultAbiCoder().encode(["address"], [getAddress(address)]);
  return keccak256(getBytes(keccak256(getBytes(encoded))));
}

/** Sorted pair hash. Order-independent, matching SavingsVault._hashPair. */
export function hashPair(left, right) {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return keccak256(concat([getBytes(lo), getBytes(hi)]));
}

function buildLayers(leaves) {
  if (leaves.length === 0) return [[ZERO_ROOT]];
  const layers = [leaves.slice()];
  let level = leaves;
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      if (i + 1 === level.length) next.push(level[i]);
      else next.push(hashPair(level[i], level[i + 1]));
    }
    layers.push(next);
    level = next;
  }
  return layers;
}

export class MerkleTree {
  constructor(addresses) {
    const unique = [...new Set(addresses.map((address) => getAddress(address)))];
    this.addresses = unique;
    this.ordered = unique
      .map((address) => ({ address, leaf: hashLeaf(address) }))
      .sort((x, y) => (x.leaf.toLowerCase() < y.leaf.toLowerCase() ? -1 : 1));
    this.layers = buildLayers(this.ordered.map((entry) => entry.leaf));
  }

  root() {
    const top = this.layers[this.layers.length - 1];
    return top.length === 1 ? top[0] : ZERO_ROOT;
  }

  getProof(address) {
    let checksum;
    try {
      checksum = getAddress(address);
    } catch {
      return null;
    }
    const index = this.ordered.findIndex((entry) => entry.address === checksum);
    if (index < 0) return null;

    const proof = [];
    let idx = index;
    for (let layer = 0; layer < this.layers.length - 1; layer += 1) {
      const level = this.layers[layer];
      const sibling = idx ^ 1;
      if (sibling < level.length) proof.push(level[sibling]);
      idx = Math.floor(idx / 2);
    }
    return proof;
  }

  verify(address, proof, root) {
    let computed = hashLeaf(address);
    for (const sibling of proof) computed = hashPair(computed, sibling);
    return computed.toLowerCase() === root.toLowerCase();
  }
}
