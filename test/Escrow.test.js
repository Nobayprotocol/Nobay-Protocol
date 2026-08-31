const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Escrow", function () {
  let escrow;
  let nobayToken;
  let owner;
  let buyer;
  let seller;

  const ESCROW_AMOUNT = ethers.parseEther("100");

  beforeEach(async function () {
    [owner, buyer, seller] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    nobayToken = await MockERC20.deploy("Nobay Token", "NOBAY");
    await nobayToken.waitForDeployment();

    const Escrow = await ethers.getContractFactory("Escrow");
    escrow = await Escrow.deploy();
    await escrow.waitForDeployment();

    await nobayToken.mint(buyer.address, ethers.parseEther("1000"));
  });

  it("should create escrow with native ETH and release after dispute window", async function () {
    await expect(
      escrow.connect(buyer).createEscrow(seller.address, ethers.ZeroAddress, ESCROW_AMOUNT, {
        value: ESCROW_AMOUNT,
      })
    )
      .to.emit(escrow, "EscrowCreated")
      .withArgs(0, buyer.address, seller.address, ethers.ZeroAddress, ESCROW_AMOUNT);

    // Fast-forward past dispute window (3 days)
    await time.increase(3 * 24 * 60 * 60 + 1);

    const sellerBalBefore = await ethers.provider.getBalance(seller.address);
    await expect(escrow.connect(buyer).release(0))
      .to.emit(escrow, "EscrowReleased")
      .withArgs(0, seller.address);

    const sellerBalAfter = await ethers.provider.getBalance(seller.address);
    expect(sellerBalAfter - sellerBalBefore).to.equal(ESCROW_AMOUNT);
  });

  it("should allow buyer to dispute and owner to resolve", async function () {
    await escrow.connect(buyer).createEscrow(seller.address, ethers.ZeroAddress, ESCROW_AMOUNT, {
      value: ESCROW_AMOUNT,
    });

    await expect(escrow.connect(buyer).dispute(0))
      .to.emit(escrow, "EscrowDisputed")
      .withArgs(0, buyer.address);

    const buyerBalBefore = await ethers.provider.getBalance(buyer.address);
    await expect(escrow.connect(owner).resolve(0, buyer.address))
      .to.emit(escrow, "EscrowResolved")
      .withArgs(0, buyer.address);

    const buyerBalAfter = await ethers.provider.getBalance(buyer.address);
    expect(buyerBalAfter - buyerBalBefore).to.equal(ESCROW_AMOUNT);
  });
});
