const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("ListingRegistry", function () {
  async function deployRegistry() {
    const [owner, seller, other] = await ethers.getSigners();
    const ListingRegistry = await ethers.getContractFactory("ListingRegistry");
    const registry = await ListingRegistry.deploy();

    return { registry, owner, seller, other };
  }

  async function signListing(registry, signer, sellerAddress, uri, timestamp) {
    const { chainId } = await ethers.provider.getNetwork();

    return signer.signTypedData(
      {
        name: "Nobay Listing",
        chainId,
        verifyingContract: await registry.getAddress()
      },
      {
        Listing: [
          { name: "seller", type: "address" },
          { name: "uri", type: "string" },
          { name: "timestamp", type: "uint256" }
        ]
      },
      {
        seller: sellerAddress,
        uri,
        timestamp
      }
    );
  }

  it("accepts a seller signed listing and stores it as active", async function () {
    const { registry, seller } = await deployRegistry();
    const uri = "ipfs://bafybeigoodlisting";
    const timestamp = 1710000000;
    const signature = await signListing(registry, seller, seller.address, uri, timestamp);

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

  it("rejects a listing when the signature was not produced by the seller", async function () {
    const { registry, seller, other } = await deployRegistry();
    const uri = "ipfs://bafybeibadsigner";
    const timestamp = 1710000001;
    const signature = await signListing(registry, other, seller.address, uri, timestamp);

    await expect(
      registry.submitListingWithSig(seller.address, uri, timestamp, signature)
    ).to.be.revertedWith("Invalid signature");
  });

  it("lets the seller revoke an active listing", async function () {
    const { registry, seller } = await deployRegistry();
    const uri = "ipfs://bafybeirevokable";
    const timestamp = 1710000002;
    const signature = await signListing(registry, seller, seller.address, uri, timestamp);
    await registry.submitListingWithSig(seller.address, uri, timestamp, signature);

    await expect(registry.connect(seller).revokeListing(0))
      .to.emit(registry, "ListingRevoked")
      .withArgs(0, seller.address, anyValue);

    const listing = await registry.listings(0);
    expect(listing.active).to.equal(false);
  });

  it("blocks non-sellers from revoking a listing", async function () {
    const { registry, seller, other } = await deployRegistry();
    const uri = "ipfs://bafybeinotseller";
    const timestamp = 1710000003;
    const signature = await signListing(registry, seller, seller.address, uri, timestamp);
    await registry.submitListingWithSig(seller.address, uri, timestamp, signature);

    await expect(registry.connect(other).revokeListing(0)).to.be.revertedWith("Not your listing");
  });

  it("lets the owner force revoke a listing", async function () {
    const { registry, seller } = await deployRegistry();
    const uri = "ipfs://bafybeiforcerevoke";
    const timestamp = 1710000004;
    const signature = await signListing(registry, seller, seller.address, uri, timestamp);
    await registry.submitListingWithSig(seller.address, uri, timestamp, signature);

    await expect(registry.forceRevoke(0))
      .to.emit(registry, "ListingRevoked")
      .withArgs(0, seller.address, anyValue);

    const listing = await registry.listings(0);
    expect(listing.active).to.equal(false);
  });
});
