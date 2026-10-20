import type { AbiFunction } from "./types";

function fn(
  name: string,
  stateMutability: AbiFunction["stateMutability"],
  inputs: AbiFunction["inputs"],
  outputs: AbiFunction["outputs"],
): AbiFunction {
  return { name, type: "function", stateMutability, inputs, outputs };
}

export const erc20 = {
  symbol: fn("symbol", "view", [], [{ name: "", type: "string" }]),
  decimals: fn("decimals", "view", [], [{ name: "", type: "uint8" }]),
  balanceOf: fn("balanceOf", "view", [{ name: "account", type: "address" }], [{ name: "", type: "uint256" }]),
  allowance: fn(
    "allowance",
    "view",
    [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    [{ name: "", type: "uint256" }],
  ),
  approve: fn(
    "approve",
    "nonpayable",
    [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    [{ name: "", type: "bool" }],
  ),
};

export const vaultAbi = {
  asset: fn("asset", "view", [], [{ name: "", type: "address" }]),
  owner: fn("owner", "view", [], [{ name: "", type: "address" }]),
  allowlistRoot: fn("allowlistRoot", "view", [], [{ name: "", type: "bytes32" }]),
  paused: fn("paused", "view", [], [{ name: "", type: "bool" }]),
  totalAssets: fn("totalAssets", "view", [], [{ name: "", type: "uint256" }]),
  balanceOf: fn("balanceOf", "view", [{ name: "account", type: "address" }], [{ name: "", type: "uint256" }]),
  isAllowlisted: fn(
    "isAllowlisted",
    "view",
    [
      { name: "account", type: "address" },
      { name: "proof", type: "bytes32[]" },
    ],
    [{ name: "", type: "bool" }],
  ),
  deposit: fn(
    "deposit",
    "nonpayable",
    [
      { name: "assets", type: "uint256" },
      { name: "proof", type: "bytes32[]" },
    ],
    [],
  ),
  withdraw: fn("withdraw", "nonpayable", [{ name: "assets", type: "uint256" }], []),
  setAllowlistRoot: fn("setAllowlistRoot", "nonpayable", [{ name: "root", type: "bytes32" }], []),
  setPaused: fn("setPaused", "nonpayable", [{ name: "status", type: "bool" }], []),
};
