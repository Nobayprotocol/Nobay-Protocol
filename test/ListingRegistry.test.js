const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("ListingRegistry", function () {
  async function deployFixture() {
    const [owner, seller, attacker] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("ListingRegistry");
    const registry = await Registry.connect(owner).deploy();
    await registry.waitForDeployment();
    return { registry, owner, seller, attacker };
  }

  async function signListing({ signer, registry, seller, uri, timestamp }) {
    const network = await ethers.provider.getNetwork();
    const domain = {
      name: "Nobay Listing",
      chainId: Number(network.chainId),
      verifyingContract: await registry.getAddress()
    };
    const types = {
      Listing: [
        { name: "seller", type: "address" },
        { name: "uri", type: "string" },
        { name: "timestamp", type: "uint256" }
      ]
    };
    const value = {
      seller,
      uri,
      timestamp
    };

    return signer.signTypedData(domain, types, value);
  }

  it("accepts valid EIP-712 signatures and stores listing metadata", async function () {
    const { registry, seller } = await deployFixture();

    const uri = "ipfs://bafybeigdyr4example";
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await signListing({
      signer: seller,
      registry,
      seller: seller.address,
      uri,
      timestamp
    });

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
    const { registry, seller, attacker } = await deployFixture();
    const uri = "ipfs://bafybeibadsig";
    const timestamp = Math.floor(Date.now() / 1000);

    const badSignature = await signListing({
      signer: attacker,
      registry,
      seller: seller.address,
      uri,
      timestamp
    });

    await expect(
      registry.submitListingWithSig(seller.address, uri, timestamp, badSignature)
    ).to.be.revertedWith("Invalid signature");
  });

  it("emits revoke events and preserves seller mapping integrity", async function () {
    const { registry, seller, attacker } = await deployFixture();
    const uri = "ipfs://bafybeirevoke";
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await signListing({
      signer: seller,
      registry,
      seller: seller.address,
      uri,
      timestamp
    });

    await registry.submitListingWithSig(seller.address, uri, timestamp, signature);

    await expect(registry.connect(attacker).revokeListing(0)).to.be.revertedWith("Not your listing");

    await expect(registry.connect(seller).revokeListing(0))
      .to.emit(registry, "ListingRevoked")
      .withArgs(0, seller.address, anyValue);

    const listing = await registry.listings(0);
    expect(listing.seller).to.equal(seller.address);
    expect(listing.uri).to.equal(uri);
    expect(listing.active).to.equal(false);
  });
});
