const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SlashingModule", function () {
  let token, slashingModule;
  let owner, slasher, seller, treasury, unauthorized;

  beforeEach(async function () {
    [owner, slasher, seller, treasury, unauthorized] = await ethers.getSigners();

    // Deploy mock ERC20 token
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    token = await MockERC20Factory.deploy("Nobay Token", "NOBAY", ethers.parseEther("1000000"));
    await token.waitForDeployment();

    // Deploy SlashingModule
    const SlashingModuleFactory = await ethers.getContractFactory("SlashingModule");
    slashingModule = await SlashingModuleFactory.deploy(await token.getAddress(), treasury.address);
    await slashingModule.waitForDeployment();

    // Fund slashingModule with tokens to simulate slashed collateral
    await token.transfer(await slashingModule.getAddress(), ethers.parseEther("10000"));

    // Authorize slasher
    await slashingModule.setSlasher(slasher.address, true);
  });

  describe("Slasher Authorization", function () {
    it("Should allow owner to authorize and revoke slashers", async function () {
      expect(await slashingModule.authorizedSlashers(slasher.address)).to.be.true;
      await slashingModule.setSlasher(slasher.address, false);
      expect(await slashingModule.authorizedSlashers(slasher.address)).to.be.false;
    });

    it("Should prevent non-owner from setting slashers", async function () {
      await expect(
        slashingModule.connect(unauthorized).setSlasher(unauthorized.address, true)
      ).to.be.reverted;
    });
  });

  describe("Slash Execution", function () {
    it("Should allow authorized slasher to slash and transfer funds to DAO treasury", async function () {
      const slashAmount = ethers.parseEther("500");
      const reason = "Fraudulent item delivered in dispute #42";

      const treasuryBefore = await token.balanceOf(treasury.address);

      await expect(
        slashingModule.connect(slasher).slash(seller.address, slashAmount, reason)
      )
        .to.emit(slashingModule, "Slashed")
        .withArgs(seller.address, slashAmount, reason);

      const treasuryAfter = await token.balanceOf(treasury.address);
      expect(treasuryAfter - treasuryBefore).to.equal(slashAmount);

      const profile = await slashingModule.profiles(seller.address);
      expect(profile.totalSlashedAmount).to.equal(slashAmount);
      expect(profile.slashCount).to.equal(1);
    });

    it("Should prevent unauthorized address from slashing", async function () {
      await expect(
        slashingModule.connect(unauthorized).slash(seller.address, ethers.parseEther("100"), "Unauthorized attempt")
      ).to.be.revertedWith("Not authorized to slash");
    });
  });

  describe("Trust Score & Time Decay", function () {
    it("Should increase trust score on successful trades", async function () {
      await slashingModule.connect(slasher).recordSuccessfulTrade(seller.address, 5000); // 50% trust
      expect(await slashingModule.getDecayedTrustScore(seller.address)).to.equal(5000);
    });

    it("Should decay trust score after prolonged inactivity (30 days)", async function () {
      await slashingModule.connect(slasher).recordSuccessfulTrade(seller.address, 5000);

      // Fast forward time by 30 days
      await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine");

      // 1% decay on 5000 = 50 points -> 4950
      const decayedScore = await slashingModule.getDecayedTrustScore(seller.address);
      expect(decayedScore).to.equal(4950);
    });
  });
});
