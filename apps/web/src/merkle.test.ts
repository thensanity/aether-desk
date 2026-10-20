import { DEMO_ALLOWLIST, MerkleTree, hashPair } from "@aether/merkle";
import { describe, expect, it } from "vitest";

describe("MerkleTree", () => {
  it("is insensitive to input order and proves every leaf", () => {
    const forward = new MerkleTree(DEMO_ALLOWLIST);
    const reversed = new MerkleTree([...DEMO_ALLOWLIST].reverse());
    expect(reversed.root()).toBe(forward.root());
    for (const account of DEMO_ALLOWLIST) {
      const proof = forward.getProof(account);
      expect(proof).not.toBeNull();
      expect(forward.verify(account, proof ?? [], forward.root())).toBe(true);
    }
  });

  it("rejects an account outside the tree", () => {
    const tree = new MerkleTree(DEMO_ALLOWLIST);
    expect(tree.getProof("0x0000000000000000000000000000000000000001")).toBeNull();
    expect(tree.verify("0x0000000000000000000000000000000000000001", [], tree.root())).toBe(false);
  });

  it("hashes a pair in either order to the same node", () => {
    const left = `0x${"11".repeat(32)}`;
    const right = `0x${"22".repeat(32)}`;
    expect(hashPair(left, right)).toBe(hashPair(right, left));
  });
});
