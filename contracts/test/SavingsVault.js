const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SavingsVault", function () {
  let MerkleTree;

  before(async () => {
    ({ MerkleTree } = await import("@aether/merkle"));
  });

  async function fixture() {
    const [owner, alice, bob, carol] = await ethers.getSigners();
    const tree = new MerkleTree([alice.address, bob.address]);
    const token = await ethers.deployContract("MockERC20");
    const vault = await ethers.deployContract("SavingsVault", [await token.getAddress(), tree.root()]);
    await token.mint(alice.address, ethers.parseEther("1000"));
    await token.mint(bob.address, ethers.parseEther("1000"));
    await token.mint(carol.address, ethers.parseEther("1000"));
    return { owner, alice, bob, carol, tree, token, vault };
  }

  it("accepts an allowlisted deposit and rejects everyone else", async function () {
    const { alice, carol, tree, token, vault } = await fixture();
    const amount = ethers.parseEther("25");
    await token.connect(alice).approve(await vault.getAddress(), amount);

    await expect(vault.connect(alice).deposit(amount, tree.getProof(alice.address)))
      .to.emit(vault, "Deposited")
      .withArgs(alice.address, amount);

    expect(await vault.balanceOf(alice.address)).to.equal(amount);
    expect(await vault.totalAssets()).to.equal(amount);
    expect(await token.balanceOf(await vault.getAddress())).to.equal(amount);

    await token.connect(carol).approve(await vault.getAddress(), amount);
    await expect(vault.connect(carol).deposit(amount, [])).to.be.revertedWithCustomError(vault, "NotAllowlisted");
  });

  it("withdraws only the caller's balance", async function () {
    const { alice, tree, token, vault } = await fixture();
    const amount = ethers.parseEther("40");
    await token.connect(alice).approve(await vault.getAddress(), amount);
    await vault.connect(alice).deposit(amount, tree.getProof(alice.address));

    await expect(vault.connect(alice).withdraw(ethers.parseEther("100"))).to.be.revertedWithCustomError(
      vault,
      "InsufficientBalance",
    );

    await vault.connect(alice).withdraw(ethers.parseEther("15"));
    expect(await vault.balanceOf(alice.address)).to.equal(ethers.parseEther("25"));
    expect(await token.balanceOf(alice.address)).to.equal(ethers.parseEther("975"));
  });

  it("deposits the demo allowlist shipped to the frontend", async function () {
    const { DEMO_ALLOWLIST } = await import("@aether/merkle");
    const [deployer] = await ethers.getSigners();
    expect(DEMO_ALLOWLIST).to.include(deployer.address);
    const tree = new MerkleTree(DEMO_ALLOWLIST);
    const token = await ethers.deployContract("MockERC20");
    const vault = await ethers.deployContract("SavingsVault", [await token.getAddress(), tree.root()]);
    const amount = ethers.parseEther("25");
    await token.mint(deployer.address, amount);
    await token.approve(await vault.getAddress(), amount);
    await vault.deposit(amount, tree.getProof(deployer.address));
    expect(await vault.balanceOf(deployer.address)).to.equal(amount);
    expect(await vault.isAllowlisted(deployer.address, tree.getProof(deployer.address))).to.equal(true);
  });

  it("lets the owner rotate the root and pause deposits", async function () {
    const { owner, alice, carol, tree, token, vault } = await fixture();
    const next = new MerkleTree([carol.address]);
    await expect(vault.connect(alice).setAllowlistRoot(next.root())).to.be.revertedWithCustomError(vault, "NotOwner");

    await vault.connect(owner).setAllowlistRoot(next.root());
    expect(await vault.isAllowlisted(carol.address, next.getProof(carol.address))).to.equal(true);
    expect(await vault.isAllowlisted(alice.address, tree.getProof(alice.address))).to.equal(false);

    await vault.connect(owner).setPaused(true);
    const amount = ethers.parseEther("1");
    await token.connect(carol).approve(await vault.getAddress(), amount);
    await expect(vault.connect(carol).deposit(amount, next.getProof(carol.address))).to.be.revertedWithCustomError(
      vault,
      "Paused",
    );
  });
});
