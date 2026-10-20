const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const ZERO = "0x0000000000000000000000000000000000000000";

async function main() {
  const { MerkleTree, DEMO_ALLOWLIST } = await import("@aether/merkle");
  const [deployer] = await hre.ethers.getSigners();
  const tree = new MerkleTree(DEMO_ALLOWLIST);

  const token = await hre.ethers.deployContract("MockERC20");
  await token.waitForDeployment();
  const vault = await hre.ethers.deployContract("SavingsVault", [await token.getAddress(), tree.root()]);
  await vault.waitForDeployment();

  const mintAmount = hre.ethers.parseEther("10000");
  for (const account of DEMO_ALLOWLIST) {
    const tx = await token.mint(account, mintAmount);
    await tx.wait();
  }

  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  const record = {
    token: await token.getAddress(),
    vault: await vault.getAddress(),
    allowlistRoot: tree.root(),
  };

  const outPath = path.join(__dirname, "..", "..", "apps", "web", "src", "generated", "deployments.json");
  const existing = JSON.parse(fs.readFileSync(outPath, "utf8"));
  existing[String(chainId)] = record;
  fs.writeFileSync(outPath, `${JSON.stringify(existing, null, 2)}\n`);

  console.log(`Deployer ${deployer.address}`);
  console.log(`Chain    ${chainId}`);
  console.log(`Token    ${record.token}`);
  console.log(`Vault    ${record.vault}`);
  console.log(`Root     ${record.allowlistRoot}`);
  console.log(`Wrote    ${outPath}`);
  if (record.token === ZERO) throw new Error("Deployment returned the zero address");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
