const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

async function signListing(signer, registry, seller, uri, timestamp) {
  const { chainId } = await ethers.provider.getNetwork();
  return signer.signTypedData(
    {
      name: "Nobay Listing",
      chainId,
      verifyingContract: await registry.getAddress(),
    },
    {
      Listing: [
        { name: "seller", type: "address" },
        { name: "uri", type: "string" },
        { name: "timestamp", type: "uint256" },
      ],
    },
    { seller, uri, timestamp }
  );
}

describe("ListingRegistry", function () {
  let registry;
  let owner;
  let seller;
  let other;

  const uri = "ipfs://QmListingMetadata";
  const timestamp = 1710000000;

  beforeEach(async function () {
    [owner, seller, other] = await ethers.getSigners();
    const ListingRegistry = await ethers.getContractFactory("ListingRegistry");
    registry = await ListingRegistry.deploy();
  });

  it("accepts a valid EIP-712 listing signature, emits event, and stores metadata", async function () {
    const signature = await signListing(seller, registry, seller.address, uri, timestamp);

    await expect(registry.submitListingWithSig(seller.address, uri, timestamp, signature))
      .to.emit(registry, "ListingVerified")
      .withArgs(0, seller.address, uri, timestamp);

    const listing = await registry.listings(0);
    expect(listing.seller).to.equal(seller.address);
    expect(listing.uri).to.equal(uri);
    expect(listing.timestamp).to.equal(timestamp);
    expect(listing.active).to.equal(true);
    expect(await registry.listingCount()).to.equal(1);
  });

  it("rejects invalid signatures", async function () {
    const signature = await signListing(other, registry, seller.address, uri, timestamp);

    await expect(
      registry.submitListingWithSig(seller.address, uri, timestamp, signature)
    ).to.be.revertedWith("Invalid signature");
  });

  it("rejects signatures when submitted metadata differs from signed payload", async function () {
    const signature = await signListing(seller, registry, seller.address, uri, timestamp);

    await expect(
      registry.submitListingWithSig(seller.address, "ipfs://different", timestamp, signature)
    ).to.be.revertedWith("Invalid signature");
  });

  it("allows only the seller to revoke and emits revocation event", async function () {
    const signature = await signListing(seller, registry, seller.address, uri, timestamp);
    await registry.submitListingWithSig(seller.address, uri, timestamp, signature);

    await expect(registry.connect(other).revokeListing(0)).to.be.revertedWith("Not your listing");

    await expect(registry.connect(seller).revokeListing(0))
      .to.emit(registry, "ListingRevoked")
      .withArgs(0, seller.address, anyValue);

    expect((await registry.listings(0)).active).to.equal(false);
  });

  it("lets the owner force revoke a listing", async function () {
    const signature = await signListing(seller, registry, seller.address, uri, timestamp);
    await registry.submitListingWithSig(seller.address, uri, timestamp, signature);

    await registry.connect(owner).forceRevoke(0);

    expect((await registry.listings(0)).active).to.equal(false);
  });
});
