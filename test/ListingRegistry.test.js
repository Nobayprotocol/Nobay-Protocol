const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ListingRegistry", function () {
  let registry;
  let owner;
  let seller;
  let buyer;

  beforeEach(async function () {
    [owner, seller, buyer] = await ethers.getSigners();
    const ListingRegistry = await ethers.getContractFactory("ListingRegistry");
    registry = await ListingRegistry.deploy();
    await registry.waitForDeployment();
  });

  it("should submit a valid EIP-712 listing with signature", async function () {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const uri = "ipfs://QmTest123456789";
    const timestamp = Math.floor(Date.now() / 1000);

    const domain = {
      name: "Nobay Listing",
      chainId: chainId,
      verifyingContract: await registry.getAddress(),
    };

    const types = {
      Listing: [
        { name: "seller", type: "address" },
        { name: "uri", type: "string" },
        { name: "timestamp", type: "uint256" },
      ],
    };

    const value = {
      seller: seller.address,
      uri: uri,
      timestamp: timestamp,
    };

    const signature = await seller.signTypedData(domain, types, value);

    await expect(
      registry.connect(seller).submitListingWithSig(seller.address, uri, timestamp, signature)
    )
      .to.emit(registry, "ListingVerified")
      .withArgs(0, seller.address, uri, timestamp);

    const listing = await registry.listings(0);
    expect(listing.seller).to.equal(seller.address);
    expect(listing.uri).to.equal(uri);
    expect(listing.active).to.be.true;
  });

  it("should allow seller to revoke their listing", async function () {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const uri = "ipfs://QmTest123456789";
    const timestamp = Math.floor(Date.now() / 1000);

    const domain = {
      name: "Nobay Listing",
      chainId: chainId,
      verifyingContract: await registry.getAddress(),
    };

    const types = {
      Listing: [
        { name: "seller", type: "address" },
        { name: "uri", type: "string" },
        { name: "timestamp", type: "uint256" },
      ],
    };

    const signature = await seller.signTypedData(domain, types, {
      seller: seller.address,
      uri: uri,
      timestamp: timestamp,
    });

    await registry.submitListingWithSig(seller.address, uri, timestamp, signature);

    await expect(registry.connect(seller).revokeListing(0))
      .to.emit(registry, "ListingRevoked");

    const listing = await registry.listings(0);
    expect(listing.active).to.be.false;
  });
});
