const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ListingRegistry", function () {
  let registry;
  let owner, seller, buyer, other;
  const DOMAIN_NAME = "Nobay Listing Registry";
  const DOMAIN_VERSION = "1";

  beforeEach(async function () {
    [owner, seller, buyer, other] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("ListingRegistry");
    registry = await Registry.deploy();
    await registry.waitForDeployment();
  });

  function getDomain(verifyingContract) {
    const network = ethers.provider.getNetwork ? { chainId: 31337 } : {};
    return {
      name: DOMAIN_NAME,
      version: DOMAIN_VERSION,
      chainId: 31337,
      verifyingContract
    };
  }

  function getTypes() {
    return {
      Listing: [
        { name: "listingId", type: "bytes32" },
        { name: "seller", type: "address" },
        { name: "token", type: "address" },
        { name: "tokenId", type: "uint256" },
        { name: "price", type: "uint256" },
        { name: "expiresAt", type: "uint256" }
      ]
    };
  }

  async function signListing(signer, params) {
    const domain = getDomain(await registry.getAddress());
    return signer.signTypedData(domain, getTypes(), params);
  }

  it("should create listing with valid signature and emit event", async function () {
    const listingId = ethers.id("listing-1");
    const token = ethers.Wallet.createRandom().address;
    const tokenId = 1n;
    const price = ethers.parseEther("1.0");
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;

    const value = { listingId, seller: seller.address, token, tokenId, price, expiresAt };
    const signature = await signListing(seller, value);

    await expect(
      registry.createListing(listingId, seller.address, token, tokenId, price, expiresAt, signature)
    )
      .to.emit(registry, "ListingCreated")
      .withArgs(listingId, seller.address, token, tokenId, price, expiresAt);

    const stored = await registry.listings(listingId);
    expect(stored.seller).to.equal(seller.address);
    expect(stored.token).to.equal(token);
    expect(stored.tokenId).to.equal(tokenId);
    expect(stored.price).to.equal(price);
    expect(stored.expiresAt).to.equal(BigInt(expiresAt));
  });

  it("should reject listing with invalid signer", async function () {
    const listingId = ethers.id("listing-2");
    const token = ethers.Wallet.createRandom().address;
    const tokenId = 2n;
    const price = ethers.parseEther("1.0");
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;

    const value = { listingId, seller: seller.address, token, tokenId, price, expiresAt };
    const badSignature = await signListing(other, value);

    await expect(
      registry.createListing(listingId, seller.address, token, tokenId, price, expiresAt, badSignature)
    ).to.be.revertedWithCustomError(registry, "InvalidSignature");
  });

  it("should reject tampered metadata", async function () {
    const listingId = ethers.id("listing-3");
    const token = ethers.Wallet.createRandom().address;
    const tokenId = 3n;
    const price = ethers.parseEther("1.0");
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;

    const value = { listingId, seller: seller.address, token, tokenId, price, expiresAt };
    const signature = await signListing(seller, value);

    const tamperedPrice = ethers.parseEther("2.0");
    await expect(
      registry.createListing(listingId, seller.address, token, tokenId, tamperedPrice, expiresAt, signature)
    ).to.be.reverted;
  });

  it("should store seller mapping and metadata accurately", async function () {
    const listingId = ethers.id("listing-4");
    const token = ethers.Wallet.createRandom().address;
    const tokenId = 42n;
    const price = ethers.parseEther("0.5");
    const expiresAt = Math.floor(Date.now() / 1000) + 7200;

    const value = { listingId, seller: seller.address, token, tokenId, price, expiresAt };
    const signature = await signListing(seller, value);

    await registry.createListing(listingId, seller.address, token, tokenId, price, expiresAt, signature);

    const stored = await registry.listings(listingId);
    expect(stored.seller).to.equal(seller.address);
    expect(stored.token).to.equal(token);
    expect(stored.tokenId).to.equal(tokenId);
    expect(stored.price).to.equal(price);
    expect(stored.expiresAt).to.equal(BigInt(expiresAt));
    expect(await registry.sellerOf(listingId)).to.equal(seller.address);
  });
});
