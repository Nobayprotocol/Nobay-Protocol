const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("StakingModule", function () {
  let nobayToken;
  let stakingModule;
  let owner;
  let slasher;
  let user1;
  let user2;
  let treasury;

  const MINT_AMOUNT = ethers.parseEther("500000");

  beforeEach(async function () {
    [owner, slasher, user1, user2, treasury] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    nobayToken = await MockERC20.deploy("Nobay Token", "NOBAY");
    await nobayToken.waitForDeployment();

    const StakingModule = await ethers.getContractFactory("StakingModule");
    stakingModule = await StakingModule.deploy(await nobayToken.getAddress());
    await stakingModule.waitForDeployment();

    await nobayToken.mint(user1.address, MINT_AMOUNT);
    await nobayToken.mint(user2.address, MINT_AMOUNT);

    await stakingModule.setSlashingModule(slasher.address);
  });

  describe("Staking and Tiers", function () {
    it("should allow user to stake tokens and record active stake", async function () {
      const stakeAmount = ethers.parseEther("5000");
      await nobayToken.connect(user1).approve(await stakingModule.getAddress(), stakeAmount);

      await expect(stakingModule.connect(user1).stake(stakeAmount))
        .to.emit(stakingModule, "Staked")
        .withArgs(user1.address, stakeAmount, await time.latest() + 1);

      expect(await stakingModule.stakedBalance(user1.address)).to.equal(stakeAmount);
      expect(await stakingModule.isStaked(user1.address)).to.be.true;
    });

    it("should calculate trust tiers accurately based on stake amounts", async function () {
      // Tier 0: < 1,000
      expect(await stakingModule.getTier(user1.address)).to.equal(0);

      // Tier 1: Verified (>= 1,000)
      await nobayToken.connect(user1).approve(await stakingModule.getAddress(), ethers.parseEther("1000"));
      await stakingModule.connect(user1).stake(ethers.parseEther("1000"));
      expect(await stakingModule.getTier(user1.address)).to.equal(1);

      // Tier 2: Trusted (>= 10,000)
      await nobayToken.connect(user1).approve(await stakingModule.getAddress(), ethers.parseEther("9000"));
      await stakingModule.connect(user1).stake(ethers.parseEther("9000"));
      expect(await stakingModule.getTier(user1.address)).to.equal(2);

      // Tier 3: Elite (>= 100,000)
      await nobayToken.connect(user1).approve(await stakingModule.getAddress(), ethers.parseEther("90000"));
      await stakingModule.connect(user1).stake(ethers.parseEther("90000"));
      expect(await stakingModule.getTier(user1.address)).to.equal(3);
    });

    it("should revert if staking zero amount", async function () {
      await expect(
        stakingModule.connect(user1).stake(0)
      ).to.be.revertedWith("Cannot stake zero");
    });
  });

  describe("Unstaking and Cooldown", function () {
    const stakeAmount = ethers.parseEther("5000");

    beforeEach(async function () {
      await nobayToken.connect(user1).approve(await stakingModule.getAddress(), stakeAmount);
      await stakingModule.connect(user1).stake(stakeAmount);
    });

    it("should revert unstake before cooldown period elapses", async function () {
      await expect(
        stakingModule.connect(user1).unstake()
      ).to.be.revertedWith("Cooldown not met");
    });

    it("should unstake successfully after cooldown period (3 days)", async function () {
      await time.increase(3 * 24 * 60 * 60 + 1);

      const balBefore = await nobayToken.balanceOf(user1.address);
      await expect(stakingModule.connect(user1).unstake())
        .to.emit(stakingModule, "Unstaked")
        .withArgs(user1.address, stakeAmount, await time.latest() + 1);

      const balAfter = await nobayToken.balanceOf(user1.address);
      expect(balAfter - balBefore).to.equal(stakeAmount);
      expect(await stakingModule.stakedBalance(user1.address)).to.equal(0);
      expect(await stakingModule.isStaked(user1.address)).to.be.false;
    });

    it("should allow owner to update cooldown window", async function () {
      const newCooldown = 1 * 24 * 60 * 60; // 1 day
      await stakingModule.connect(owner).setCooldown(newCooldown);
      expect(await stakingModule.cooldownPeriod()).to.equal(newCooldown);
    });
  });

  describe("Slashing Integration", function () {
    const stakeAmount = ethers.parseEther("10000");

    beforeEach(async function () {
      await nobayToken.connect(user1).approve(await stakingModule.getAddress(), stakeAmount);
      await stakingModule.connect(user1).stake(stakeAmount);
    });

    it("should allow authorized slashing module to slash stake and send tokens to recipient", async function () {
      const slashAmount = ethers.parseEther("4000");
      const treasuryBefore = await nobayToken.balanceOf(treasury.address);

      await expect(
        stakingModule.connect(slasher).slash(user1.address, slashAmount, treasury.address, "Dispute loss")
      )
        .to.emit(stakingModule, "StakeSlashed")
        .withArgs(user1.address, treasury.address, slashAmount, "Dispute loss", await time.latest() + 1);

      expect(await stakingModule.stakedBalance(user1.address)).to.equal(stakeAmount - slashAmount);
      expect(await nobayToken.balanceOf(treasury.address)).to.equal(treasuryBefore + slashAmount);
    });

    it("should reset cooldown on partial slash to protect against dispute exit", async function () {
      // Advance 2 days
      await time.increase(2 * 24 * 60 * 60);

      // Slashed
      await stakingModule.connect(slasher).slash(user1.address, ethers.parseEther("2000"), treasury.address, "Slash");

      // Advance 2 days (less than 3 days since slash)
      await time.increase(2 * 24 * 60 * 60);

      // Should fail cooldown
      await expect(
        stakingModule.connect(user1).unstake()
      ).to.be.revertedWith("Cooldown not met");

      // Advance another 2 days (total 4 days after slash)
      await time.increase(2 * 24 * 60 * 60);

      // Now succeeds
      await expect(stakingModule.connect(user1).unstake()).to.emit(stakingModule, "Unstaked");
    });

    it("should revert if unauthorized caller tries to slash", async function () {
      await expect(
        stakingModule.connect(user2).slash(user1.address, ethers.parseEther("1000"), treasury.address, "Fraud")
      ).to.be.revertedWith("StakingModule: caller is not authorized to slash");
    });
  });
});
