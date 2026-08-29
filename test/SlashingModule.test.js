const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("SlashingModule", function () {
  let nobayToken;
  let stakingModule;
  let slashingModule;
  let owner;
  let dao;
  let treasury;
  let arbitrator;
  let staker1;
  let staker2;
  let attacker;

  const INITIAL_MINT = ethers.parseEther("1000000");
  const STAKE_AMOUNT = ethers.parseEther("10000"); // Trusted tier

  beforeEach(async function () {
    [owner, dao, treasury, arbitrator, staker1, staker2, attacker] = await ethers.getSigners();

    // Deploy MockERC20 token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    nobayToken = await MockERC20.deploy("Nobay Token", "NOBAY");
    await nobayToken.waitForDeployment();

    // Deploy StakingModule
    const StakingModule = await ethers.getContractFactory("StakingModule");
    stakingModule = await StakingModule.deploy(await nobayToken.getAddress());
    await stakingModule.waitForDeployment();

    // Deploy SlashingModule
    const SlashingModule = await ethers.getContractFactory("SlashingModule");
    slashingModule = await SlashingModule.deploy(
      await stakingModule.getAddress(),
      dao.address,
      treasury.address
    );
    await slashingModule.waitForDeployment();

    // Link SlashingModule to StakingModule
    await stakingModule.setSlashingModule(await slashingModule.getAddress());

    // Authorize arbitrator
    await slashingModule.setDisputeResolver(arbitrator.address, true);

    // Distribute tokens to stakers
    await nobayToken.mint(staker1.address, INITIAL_MINT);
    await nobayToken.mint(staker2.address, INITIAL_MINT);

    // Approve and stake tokens
    await nobayToken.connect(staker1).approve(await stakingModule.getAddress(), STAKE_AMOUNT);
    await stakingModule.connect(staker1).stake(STAKE_AMOUNT);

    await nobayToken.connect(staker2).approve(await stakingModule.getAddress(), STAKE_AMOUNT);
    await stakingModule.connect(staker2).stake(STAKE_AMOUNT);
  });

  describe("Deployment and Configuration", function () {
    it("should initialize with correct parameters", async function () {
      expect(await slashingModule.stakingModule()).to.equal(await stakingModule.getAddress());
      expect(await slashingModule.dao()).to.equal(dao.address);
      expect(await slashingModule.treasury()).to.equal(treasury.address);
      expect(await slashingModule.disputeResolvers(arbitrator.address)).to.be.true;
    });

    it("should allow owner to update DAO address", async function () {
      await expect(slashingModule.connect(owner).setDAO(attacker.address))
        .to.emit(slashingModule, "DAOUpdated")
        .withArgs(attacker.address);
      expect(await slashingModule.dao()).to.equal(attacker.address);
    });

    it("should prevent non-owner from updating DAO address", async function () {
      await expect(
        slashingModule.connect(attacker).setDAO(attacker.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should allow owner to update treasury address", async function () {
      await expect(slashingModule.connect(owner).setTreasury(attacker.address))
        .to.emit(slashingModule, "TreasuryUpdated")
        .withArgs(attacker.address);
      expect(await slashingModule.treasury()).to.equal(attacker.address);
    });

    it("should allow owner to set dispute resolver status", async function () {
      await expect(slashingModule.connect(owner).setDisputeResolver(attacker.address, true))
        .to.emit(slashingModule, "DisputeResolverUpdated")
        .withArgs(attacker.address, true);
      expect(await slashingModule.disputeResolvers(attacker.address)).to.be.true;

      await slashingModule.connect(owner).setDisputeResolver(attacker.address, false);
      expect(await slashingModule.disputeResolvers(attacker.address)).to.be.false;
    });

    it("should allow owner to configure trust decay parameters", async function () {
      const newPeriod = 15 * 24 * 60 * 60; // 15 days
      const newRate = 200; // 2% per day

      await expect(slashingModule.connect(owner).configureTrustDecay(newPeriod, newRate))
        .to.emit(slashingModule, "TrustDecayConfigured")
        .withArgs(newPeriod, newRate);

      expect(await slashingModule.trustDecayPeriod()).to.equal(newPeriod);
      expect(await slashingModule.trustRecoveryRateBps()).to.equal(newRate);
    });
  });

  describe("Slashing by DAO", function () {
    const SLASH_AMOUNT = ethers.parseEther("2000");
    const REASON = "Governance-proven fraudulent listing";

    it("should slash staker when called by DAO", async function () {
      const treasuryBefore = await nobayToken.balanceOf(treasury.address);
      const stakeBefore = await stakingModule.stakedBalance(staker1.address);

      await expect(slashingModule.connect(dao).slashByDAO(staker1.address, SLASH_AMOUNT, REASON))
        .to.emit(slashingModule, "Slashed")
        .withArgs(staker1.address, SLASH_AMOUNT, REASON)
        .and.to.emit(slashingModule, "SlashedByDAO")
        .withArgs(staker1.address, SLASH_AMOUNT, REASON);

      const stakeAfter = await stakingModule.stakedBalance(staker1.address);
      const treasuryAfter = await nobayToken.balanceOf(treasury.address);

      expect(stakeAfter).to.equal(stakeBefore - SLASH_AMOUNT);
      expect(treasuryAfter).to.equal(treasuryBefore + SLASH_AMOUNT);
      expect(await slashingModule.totalSlashed(staker1.address)).to.equal(SLASH_AMOUNT);
      expect(await slashingModule.slashCount(staker1.address)).to.equal(1);
    });

    it("should record slash details in history", async function () {
      await slashingModule.connect(dao).slashByDAO(staker1.address, SLASH_AMOUNT, REASON);

      expect(await slashingModule.slashHistoryLength()).to.equal(1);
      const record = await slashingModule.getSlashRecord(0);
      expect(record.staker).to.equal(staker1.address);
      expect(record.amount).to.equal(SLASH_AMOUNT);
      expect(record.reason).to.equal(REASON);
      expect(record.slasher).to.equal(dao.address);
    });

    it("should revert if called by non-DAO", async function () {
      await expect(
        slashingModule.connect(attacker).slashByDAO(staker1.address, SLASH_AMOUNT, REASON)
      ).to.be.revertedWith("SlashingModule: not authorized DAO");
    });
  });

  describe("Slashing by Dispute Outcome", function () {
    const SLASH_AMOUNT = ethers.parseEther("3000");
    const DISPUTE_ID = 101;
    const REASON = "Item not received dispute ruling";

    it("should slash staker when called by authorized dispute resolver", async function () {
      await expect(
        slashingModule.connect(arbitrator).slashByDispute(staker1.address, DISPUTE_ID, SLASH_AMOUNT, REASON)
      )
        .to.emit(slashingModule, "Slashed")
        .withArgs(staker1.address, SLASH_AMOUNT, REASON)
        .and.to.emit(slashingModule, "SlashedByDispute")
        .withArgs(staker1.address, DISPUTE_ID, SLASH_AMOUNT, REASON);

      expect(await stakingModule.stakedBalance(staker1.address)).to.equal(STAKE_AMOUNT - SLASH_AMOUNT);
    });

    it("should prevent duplicate dispute slashing with the same dispute ID", async function () {
      await slashingModule.connect(arbitrator).slashByDispute(staker1.address, DISPUTE_ID, SLASH_AMOUNT, REASON);

      await expect(
        slashingModule.connect(arbitrator).slashByDispute(staker1.address, DISPUTE_ID, SLASH_AMOUNT, REASON)
      ).to.be.revertedWith("SlashingModule: dispute already processed");
    });

    it("should revert if called by unauthorized account", async function () {
      await expect(
        slashingModule.connect(attacker).slashByDispute(staker1.address, DISPUTE_ID, SLASH_AMOUNT, REASON)
      ).to.be.revertedWith("SlashingModule: not authorized dispute resolver");
    });
  });

  describe("Input Validations and Edge Cases", function () {
    it("should revert when slashing address zero", async function () {
      await expect(
        slashingModule.connect(dao).slashByDAO(ethers.ZeroAddress, ethers.parseEther("100"), "test")
      ).to.be.revertedWith("SlashingModule: invalid staker");
    });

    it("should revert when slashing zero amount", async function () {
      await expect(
        slashingModule.connect(dao).slashByDAO(staker1.address, 0, "test")
      ).to.be.revertedWith("SlashingModule: cannot slash zero amount");
    });

    it("should revert when slashing staker with no stake", async function () {
      await expect(
        slashingModule.connect(dao).slashByDAO(attacker.address, ethers.parseEther("100"), "test")
      ).to.be.revertedWith("SlashingModule: no active stake");
    });

    it("should revert when slashing more than staked balance", async function () {
      const excessiveAmount = STAKE_AMOUNT + ethers.parseEther("1");
      await expect(
        slashingModule.connect(dao).slashByDAO(staker1.address, excessiveAmount, "test")
      ).to.be.revertedWith("SlashingModule: insufficient stake");
    });

    it("should deactivate stake when slashed 100%", async function () {
      await slashingModule.connect(dao).slashByDAO(staker1.address, STAKE_AMOUNT, "Total slash");

      expect(await stakingModule.stakedBalance(staker1.address)).to.equal(0);
      expect(await stakingModule.isStaked(staker1.address)).to.be.false;

      // Staker should not be able to unstake
      await expect(
        stakingModule.connect(staker1).unstake()
      ).to.be.revertedWith("No active stake");
    });
  });

  describe("Trust Decay and Recovery (Bonus Feature)", function () {
    it("should return full trust score (10,000) when active and unslashed", async function () {
      expect(await slashingModule.getTrustScore(staker1.address)).to.equal(10000);
      expect(await slashingModule.getEffectiveStake(staker1.address)).to.equal(STAKE_AMOUNT);
    });

    it("should penalize trust score proportionally upon slashing", async function () {
      // Slash 40% of stake
      const slashAmount = ethers.parseEther("4000");
      await slashingModule.connect(dao).slashByDAO(staker1.address, slashAmount, "Fraud infraction");

      // Penalty = 4000 / 10000 * 10000 = 4000. New score = 10000 - 4000 = 6000
      expect(await slashingModule.getTrustScore(staker1.address)).to.equal(6000);

      // Effective stake = (6000 * 6000) / 10000 = 3600
      const remainingStake = STAKE_AMOUNT - slashAmount; // 6000
      const expectedEffective = (remainingStake * 6000n) / 10000n;
      expect(await slashingModule.getEffectiveStake(staker1.address)).to.equal(expectedEffective);
    });

    it("should keep trust score penalized during the decay period (30 days)", async function () {
      const slashAmount = ethers.parseEther("5000"); // 50% penalty -> 5000 score
      await slashingModule.connect(dao).slashByDAO(staker1.address, slashAmount, "Fraud");

      // Advance 15 days (halfway through decay period)
      await time.increase(15 * 24 * 60 * 60);

      expect(await slashingModule.getTrustScore(staker1.address)).to.equal(5000);
    });

    it("should recover trust gradually after decay period elapses", async function () {
      const slashAmount = ethers.parseEther("5000"); // score drops to 5000
      await slashingModule.connect(dao).slashByDAO(staker1.address, slashAmount, "Fraud");

      // Advance 30 days (decay period) + 10 days of recovery
      // Rate is 100 bps / day = 100 points / day * 10 days = 1000 points
      await time.increase(40 * 24 * 60 * 60);

      const expectedScore = 5000 + 1000; // 6000
      expect(await slashingModule.getTrustScore(staker1.address)).to.equal(expectedScore);
    });

    it("should cap recovered trust score at MAX_TRUST_SCORE (10,000)", async function () {
      const slashAmount = ethers.parseEther("2000"); // drops to 8000
      await slashingModule.connect(dao).slashByDAO(staker1.address, slashAmount, "Minor infraction");

      // Advance 30 days + 100 days (100 * 100 = 10,000 points recovery)
      await time.increase(130 * 24 * 60 * 60);

      expect(await slashingModule.getTrustScore(staker1.address)).to.equal(10000);
    });

    it("should allow checkpointing decayed trust score via applyTrustDecay", async function () {
      const slashAmount = ethers.parseEther("5000");
      await slashingModule.connect(dao).slashByDAO(staker1.address, slashAmount, "Fraud");

      // Advance 40 days
      await time.increase(40 * 24 * 60 * 60);

      const tx = await slashingModule.applyTrustDecay(staker1.address);
      await expect(tx)
        .to.emit(slashingModule, "TrustScoreUpdated");

      expect(await slashingModule.baseTrustScore(staker1.address)).to.equal(6000);
      expect(await slashingModule.getTrustScore(staker1.address)).to.equal(6000);
    });
  });

  describe("On-Chain DAO Proposal and Voting Lifecycle", function () {
    const PROPOSAL_AMOUNT = ethers.parseEther("3000");
    const PROPOSAL_REASON = "DAO Proposal #42: Malicious listing";

    it("should create a proposal and emit SlashProposed", async function () {
      await expect(
        slashingModule.connect(staker2).proposeSlash(staker1.address, PROPOSAL_AMOUNT, PROPOSAL_REASON)
      )
        .to.emit(slashingModule, "SlashProposed")
        .withArgs(1, staker2.address, staker1.address, PROPOSAL_AMOUNT, PROPOSAL_REASON);

      const prop = await slashingModule.proposals(1);
      expect(prop.target).to.equal(staker1.address);
      expect(prop.amount).to.equal(PROPOSAL_AMOUNT);
      expect(prop.proposer).to.equal(staker2.address);
      expect(prop.executed).to.be.false;
    });

    it("should allow stakers to vote proportional to their stake", async function () {
      await slashingModule.connect(staker2).proposeSlash(staker1.address, PROPOSAL_AMOUNT, PROPOSAL_REASON);

      await expect(slashingModule.connect(staker2).castVote(1, true))
        .to.emit(slashingModule, "SlashVoteCast")
        .withArgs(1, staker2.address, true, STAKE_AMOUNT);

      const prop = await slashingModule.proposals(1);
      expect(prop.votesFor).to.equal(STAKE_AMOUNT);
      expect(prop.votesAgainst).to.equal(0);
    });

    it("should prevent double voting", async function () {
      await slashingModule.connect(staker2).proposeSlash(staker1.address, PROPOSAL_AMOUNT, PROPOSAL_REASON);
      await slashingModule.connect(staker2).castVote(1, true);

      await expect(
        slashingModule.connect(staker2).castVote(1, false)
      ).to.be.revertedWith("SlashingModule: already voted");
    });

    it("should reject execution before voting ends", async function () {
      await slashingModule.connect(staker2).proposeSlash(staker1.address, PROPOSAL_AMOUNT, PROPOSAL_REASON);
      await slashingModule.connect(staker2).castVote(1, true);

      await expect(
        slashingModule.executeSlashProposal(1)
      ).to.be.revertedWith("SlashingModule: voting still active");
    });

    it("should reject execution before execution timelock delay", async function () {
      await slashingModule.connect(staker2).proposeSlash(staker1.address, PROPOSAL_AMOUNT, PROPOSAL_REASON);
      await slashingModule.connect(staker2).castVote(1, true);

      // Advance past voting (3 days) but not past execution delay (1 day)
      await time.increase(3 * 24 * 60 * 60 + 10);

      await expect(
        slashingModule.executeSlashProposal(1)
      ).to.be.revertedWith("SlashingModule: execution delay not met");
    });

    it("should execute proposal after voting period and execution delay pass", async function () {
      await slashingModule.connect(staker2).proposeSlash(staker1.address, PROPOSAL_AMOUNT, PROPOSAL_REASON);
      await slashingModule.connect(staker2).castVote(1, true);

      // Advance past 3 days voting + 1 day delay
      await time.increase(4 * 24 * 60 * 60 + 100);

      await expect(slashingModule.executeSlashProposal(1))
        .to.emit(slashingModule, "SlashProposalExecuted")
        .withArgs(1, staker1.address, PROPOSAL_AMOUNT)
        .and.to.emit(slashingModule, "Slashed")
        .withArgs(staker1.address, PROPOSAL_AMOUNT, PROPOSAL_REASON);

      expect(await stakingModule.stakedBalance(staker1.address)).to.equal(STAKE_AMOUNT - PROPOSAL_AMOUNT);
      const prop = await slashingModule.proposals(1);
      expect(prop.executed).to.be.true;
    });

    it("should reject execution if proposal failed (more against votes)", async function () {
      await slashingModule.connect(staker2).proposeSlash(staker1.address, PROPOSAL_AMOUNT, PROPOSAL_REASON);
      await slashingModule.connect(staker1).castVote(1, false);

      await time.increase(4 * 24 * 60 * 60 + 100);

      await expect(
        slashingModule.executeSlashProposal(1)
      ).to.be.revertedWith("SlashingModule: proposal rejected");
    });

    it("should allow proposer to cancel proposal", async function () {
      await slashingModule.connect(staker2).proposeSlash(staker1.address, PROPOSAL_AMOUNT, PROPOSAL_REASON);

      await expect(slashingModule.connect(staker2).cancelProposal(1, "Mistake"))
        .to.emit(slashingModule, "SlashProposalCanceled")
        .withArgs(1, "Mistake");

      const prop = await slashingModule.proposals(1);
      expect(prop.canceled).to.be.true;

      await expect(
        slashingModule.connect(staker2).castVote(1, true)
      ).to.be.revertedWith("SlashingModule: proposal canceled");
    });
  });
});
