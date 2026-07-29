const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SlashingModule", function () {
  let nobay, staking, slashing;
  let owner, staker, nonOwner, other;
  const REASON_FRAUD = ethers.id("FRAUD");
  const REASON_DISPUTE = ethers.id("DISPUTE_LOST");
  
  const DECAY_PERIOD = 30 * 24 * 60 * 60; // 30 days
  const STAKE_AMOUNT = ethers.parseEther("50000");

  beforeEach(async function () {
    [owner, staker, nonOwner, other] = await ethers.getSigners();

    // Deploy mock ERC20
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    nobay = await MockERC20.deploy();
    await nobay.waitForDeployment();

    // Deploy StakingModule
    const StakingModule = await ethers.getContractFactory("StakingModule");
    staking = await StakingModule.deploy(await nobay.getAddress());
    await staking.waitForDeployment();

    // Deploy SlashingModule
    const SlashingModule = await ethers.getContractFactory("SlashingModule");
    slashing = await SlashingModule.deploy(await staking.getAddress());
    await slashing.waitForDeployment();

    // Mint tokens to staker and approve staking
    await nobay.mint(staker.address, STAKE_AMOUNT);
    await nobay.connect(staker).approve(await staking.getAddress(), STAKE_AMOUNT);
    await staking.connect(staker).stake(STAKE_AMOUNT);
  });

  describe("Deployment", function () {
    it("should set the staking address correctly", async function () {
      expect(await slashing.staking()).to.equal(await staking.getAddress());
    });

    it("should set default trust decay parameters", async function () {
      expect(await slashing.trustDecayPeriod()).to.equal(DECAY_PERIOD);
      expect(await slashing.trustRecoveryRate()).to.equal(100);
    });

    it("should reject zero staking address", async function () {
      const SlashingFactory = await ethers.getContractFactory("SlashingModule");
      await expect(
        SlashingFactory.deploy(ethers.ZeroAddress)
      ).to.be.revertedWith("SlashingModule: invalid staking address");
    });
  });

  describe("Slashing", function () {
    beforeEach(async function () {
      // Transfer staking ownership to SlashingModule so slashStaker can be called
      await staking.transferOwnership(await slashing.getAddress());
    });

    it("should slash a staker and reduce their stake", async function () {
      const AMOUNT = ethers.parseEther("10000");
      expect(await slashing.totalSlashed(staker.address)).to.equal(0);

      const tx = await slashing.connect(owner).slash(staker.address, AMOUNT, REASON_FRAUD);
      await tx.wait();

      expect(await slashing.totalSlashed(staker.address)).to.equal(AMOUNT);
      expect(await slashing.slashCount()).to.equal(1);

      const stakeInfo = await staking.stakes(staker.address);
      expect(stakeInfo.amount).to.equal(ethers.parseEther("40000"));
      expect(stakeInfo.active).to.equal(true);
    });

    it("should emit Slashed event", async function () {
      const AMOUNT = ethers.parseEther("5000");
      const tx = await slashing.connect(owner).slash(staker.address, AMOUNT, REASON_DISPUTE);
      const receipt = await tx.wait();

      // Find Slashed event in logs
      const event = receipt.logs.find(log => {
        try {
          return log.fragment.name === "Slashed";
        } catch { return false; }
      });
      expect(event).to.not.be.undefined;
      expect(event.args.staker).to.equal(staker.address);
      expect(event.args.amount).to.equal(AMOUNT);
      expect(event.args.reason).to.equal(REASON_DISPUTE);
    });

    it("should reject slashing by non-owner", async function () {
      await expect(
        slashing.connect(nonOwner).slash(staker.address, ethers.parseEther("1000"), REASON_FRAUD)
      ).to.be.reverted;
    });

    it("should reject slashing zero amount", async function () {
      await expect(
        slashing.connect(owner).slash(staker.address, 0, REASON_FRAUD)
      ).to.be.revertedWith("SlashingModule: cannot slash zero");
    });

    it("should reject slashing invalid staker address", async function () {
      await expect(
        slashing.connect(owner).slash(ethers.ZeroAddress, ethers.parseEther("1000"), REASON_FRAUD)
      ).to.be.revertedWith("SlashingModule: invalid staker");
    });

    it("should reject slashing more than staked", async function () {
      const OVER_AMOUNT = ethers.parseEther("999999");
      await expect(
        slashing.connect(owner).slash(staker.address, OVER_AMOUNT, REASON_FRAUD)
      ).to.be.revertedWith("SlashingModule: insufficient stake");
    });

    it("should deactivate stake when slashed to zero", async function () {
      await slashing.connect(owner).slash(staker.address, STAKE_AMOUNT, REASON_FRAUD);

      const stakeInfo = await staking.stakes(staker.address);
      expect(stakeInfo.amount).to.equal(0);
      expect(stakeInfo.active).to.equal(false);
    });

    it("should handle multiple slashes for the same staker", async function () {
      const SLASH1 = ethers.parseEther("10000");
      const SLASH2 = ethers.parseEther("5000");

      await slashing.connect(owner).slash(staker.address, SLASH1, REASON_DISPUTE);
      await slashing.connect(owner).slash(staker.address, SLASH2, REASON_FRAUD);

      expect(await slashing.totalSlashed(staker.address)).to.equal(SLASH1 + SLASH2);
      expect(await slashing.slashCount()).to.equal(2);

      const stakeInfo = await staking.stakes(staker.address);
      expect(stakeInfo.amount).to.equal(ethers.parseEther("35000"));
    });

    it("should store slash history", async function () {
      const AMOUNT = ethers.parseEther("10000");
      await slashing.connect(owner).slash(staker.address, AMOUNT, REASON_FRAUD);

      const record = await slashing.slashHistory(0);
      expect(record.staker).to.equal(staker.address);
      expect(record.amount).to.equal(AMOUNT);
      expect(record.reason).to.equal(REASON_FRAUD);
    });
  });

  describe("Trust Decay", function () {
    beforeEach(async function () {
      await staking.transferOwnership(await slashing.getAddress());
    });

    it("should return full stake when no slash occurred", async function () {
      const effective = await slashing.getEffectiveStake(staker.address);
      expect(effective).to.equal(STAKE_AMOUNT);
    });

    it("should apply full penalty within decay period", async function () {
      const AMOUNT = ethers.parseEther("10000");
      await slashing.connect(owner).slash(staker.address, AMOUNT, REASON_FRAUD);

      // Just after slash — full penalty, so effective = staked - slashed
      const effective = await slashing.getEffectiveStake(staker.address); // 50000 - 10000 - 10000 = 30000
      expect(effective).to.equal(ethers.parseEther("30000"));
    });

    it("should recover trust after decay period", async function () {
      const AMOUNT = ethers.parseEther("10000");
      await slashing.connect(owner).slash(staker.address, AMOUNT, REASON_FRAUD);

      // Fast-forward past decay period + 10 days
      await ethers.provider.send("evm_increaseTime", [DECAY_PERIOD + 10 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine");

      const effective = await slashing.getEffectiveStake(staker.address);
      const staked = (await staking.stakes(staker.address)).amount; // 40000

      // 10 days * 1%/day = 10% recovery of slashed amount
      // recovered = 10000 * 100 * (10 days in seconds) / (10000 * 1 day in seconds) = 1000e18
      // remaining slash = 9000e18
      // effective = 40000 - 9000 = 31000
      expect(effective).to.equal(ethers.parseEther("31000"));
    });

    it("should return zero when penalty exceeds stake", async function () {
      const AMOUNT = ethers.parseEther("40000");
      await slashing.connect(owner).slash(staker.address, AMOUNT, REASON_FRAUD);

      // No time passed — full penalty: staked = 10000, penalty = 40000
      const effective = await slashing.getEffectiveStake(staker.address);
      expect(effective).to.equal(0);
    });
  });

  describe("Configuration", function () {
    it("should allow owner to configure trust decay", async function () {
      const newDecay = 60 * 24 * 60 * 60; // 60 days
      const newRate = 200; // 2%

      await expect(slashing.connect(owner).configureTrustDecay(newDecay, newRate))
        .to.emit(slashing, "TrustDecayConfigured")
        .withArgs(newDecay, newRate);

      expect(await slashing.trustDecayPeriod()).to.equal(newDecay);
      expect(await slashing.trustRecoveryRate()).to.equal(newRate);
    });

    it("should reject config change by non-owner", async function () {
      await expect(
        slashing.connect(nonOwner).configureTrustDecay(0, 0)
      ).to.be.reverted;
    });
  });

  describe("Integration with StakingModule", function () {
    it("should fail to slash when StakingModule ownership not transferred", async function () {
      // SlashingModule is NOT the owner of StakingModule in this test
      // slashStaker on StakingModule will revert with Ownable error
      await expect(
        slashing.connect(owner).slash(staker.address, ethers.parseEther("1000"), REASON_FRAUD)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should work when ownership is transferred", async function () {
      await staking.transferOwnership(await slashing.getAddress());
      const AMOUNT = ethers.parseEther("5000");
      const tx = await slashing.connect(owner).slash(staker.address, AMOUNT, REASON_FRAUD);
      const receipt = await tx.wait();

      const event = receipt.logs.find(log => {
        try { return log.fragment.name === "Slashed"; } catch { return false; }
      });
      expect(event).to.not.be.undefined;
      expect(await slashing.totalSlashed(staker.address)).to.equal(AMOUNT);
    });

    it("should allow staker to unstake reduced amount after slash", async function () {
      await staking.transferOwnership(await slashing.getAddress());
      const AMOUNT = ethers.parseEther("20000");
      await slashing.connect(owner).slash(staker.address, AMOUNT, REASON_FRAUD);

      // Fast forward past cooldown
      await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");

      const remaining = STAKE_AMOUNT - AMOUNT; // 30000
      const tx = await staking.connect(staker).unstake();
      const receipt = await tx.wait();
      const event = receipt.logs.find(l => {
        try { return l.fragment.name === "Unstaked"; } catch { return false; }
      });
      expect(event).to.not.be.undefined;
      expect(event.args.seller).to.equal(staker.address);
      expect(event.args.amount).to.equal(remaining);

      // Verify staker received tokens
      const balance = await nobay.balanceOf(staker.address);
      expect(balance).to.equal(remaining);
    });
  });
});
