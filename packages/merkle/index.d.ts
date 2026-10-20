export declare class MerkleTree {
  readonly addresses: readonly string[];
  constructor(addresses: readonly string[]);
  root(): string;
  getProof(address: string): string[] | null;
  verify(address: string, proof: readonly string[], root: string): boolean;
}

export declare function hashLeaf(address: string): string;
export declare function hashPair(left: string, right: string): string;
export declare const DEMO_ALLOWLIST: readonly string[];
export declare const ZERO_ROOT: string;
