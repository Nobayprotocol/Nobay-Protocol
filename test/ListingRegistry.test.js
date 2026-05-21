const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ListingRegistry", function () {
  let registry;
  let owner;
  let seller;
  let other;

  beforeEach(async function () {
    [owner, seller, other] = await ethers.getSigners();
    const ListingRegistry = await ethers.getContractFactory("ListingRegistry");
    registry = await ListingRegistry.deploy();
    await registry.waitForDeployment();
  });

  async function signListing(signer, contractAddress, uri, timestamp) {
    const domain = {
      name: "Nobay Listing",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: contractAddress
    };

    const types = {
      Listing: [
        { name: "seller", type: "address" },
        { name: "uri", type: "string" },
        { name: "timestamp", type: "uint256" }
      ]
    };

    const value = {
      seller: signer.address,
      uri: uri,
      timestamp: timestamp
    };

    return await signer.signTypedData(domain, types, value);
  }

  it("should verify signature validity and map seller accurately", async function () {
    const uri = "ipfs://QmTz...";
    const timestamp = Math.floor(Date.now() / 1000);
    const registryAddress = await registry.getAddress();

    const signature = await signListing(seller, registryAddress, uri, timestamp);

    await expect(registry.submitListingWithSig(seller.address, uri, timestamp, signature))
      .to.emit(registry, "ListingVerified")
      .withArgs(0, seller.address, uri, timestamp);

    const listing = await registry.listings(0);
    expect(listing.seller).to.equal(seller.address);
    expect(listing.uri).to.equal(uri);
    expect(listing.timestamp).to.equal(timestamp);
    expect(listing.active).to.be.true;
  });

  it("should reject invalid signatures", async function () {
    const uri = "ipfs://QmTz...";
    const timestamp = Math.floor(Date.now() / 1000);
    const registryAddress = await registry.getAddress();

    // Sign with 'other' but claim it's from 'seller'
    const signature = await signListing(other, registryAddress, uri, timestamp);

    await expect(
      registry.submitListingWithSig(seller.address, uri, timestamp, signature)
    ).to.be.revertedWith("Invalid signature");
  });

  it("should allow seller to revoke their listing and emit event", async function () {
    const uri = "ipfs://QmTz...";
    const timestamp = Math.floor(Date.now() / 1000);
    const registryAddress = await registry.getAddress();

    const signature = await signListing(seller, registryAddress, uri, timestamp);
    await registry.submitListingWithSig(seller.address, uri, timestamp, signature);

    // Revoke from seller account
    await expect(registry.connect(seller).revokeListing(0))
      .to.emit(registry, "ListingRevoked");

    const listing = await registry.listings(0);
    expect(listing.active).to.be.false;
  });

  it("should not allow non-seller to revoke listing", async function () {
    const uri = "ipfs://QmTz...";
    const timestamp = Math.floor(Date.now() / 1000);
    const registryAddress = await registry.getAddress();

    const signature = await signListing(seller, registryAddress, uri, timestamp);
    await registry.submitListingWithSig(seller.address, uri, timestamp, signature);

    // Try to revoke from 'other' account
    await expect(registry.connect(other).revokeListing(0))
      .to.be.revertedWith("Not your listing");
  });
});
