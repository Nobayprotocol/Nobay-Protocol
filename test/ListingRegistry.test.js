const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ListingRegistry", function () {
  let registry, owner, seller, buyer, domain, types;

  before(async function () {
    [owner, seller, buyer] = await ethers.getSigners();
    const ListingRegistry = await ethers.getContractFactory("ListingRegistry");
    registry = await ListingRegistry.deploy();
    await registry.waitForDeployment();

    domain = {
      name: "Nobay Listing",
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await registry.getAddress(),
    };
    types = {
      Listing: [
        { name: "seller", type: "address" },
        { name: "uri", type: "string" },
        { name: "timestamp", type: "uint256" },
      ],
    };
  });

  it("should accept valid signature and create listing", async function () {
    const uri = "ipfs://QmTest";
    const ts = Math.floor(Date.now() / 1000);
    const sig = await seller.signTypedData(domain, types, { seller: seller.address, uri, timestamp: ts });
    const tx = await registry.connect(buyer).submitListingWithSig(seller.address, uri, ts, sig);
    const receipt = await tx.wait();

    const listing = await registry.listings(0);
    expect(listing.seller).to.equal(seller.address);
    expect(listing.uri).to.equal(uri);
    expect(listing.timestamp).to.equal(ts);
    expect(listing.active).to.be.true;
    expect(await registry.listingCount()).to.equal(1);

    await expect(tx).to.emit(registry, "ListingVerified").withArgs(0, seller.address, uri, ts);
  });

  it("should reject invalid signature", async function () {
    const uri = "ipfs://QmBad";
    const ts = Math.floor(Date.now() / 1000);
    const wrongSig = await owner.signTypedData(domain, types, { seller: seller.address, uri, timestamp: ts });
    await expect(
      registry.connect(buyer).submitListingWithSig(seller.address, uri, ts, wrongSig)
    ).to.be.revertedWith("Invalid signature");
  });

  it("should increment listing counter on multiple submissions", async function () {
    const uri1 = "ipfs://QmA";
    const uri2 = "ipfs://QmB";
    const ts = Math.floor(Date.now() / 1000);
    const sig1 = await seller.signTypedData(domain, types, { seller: seller.address, uri: uri1, timestamp: ts });
    const sig2 = await seller.signTypedData(domain, types, { seller: seller.address, uri: uri2, timestamp: ts + 1 });
    await registry.connect(buyer).submitListingWithSig(seller.address, uri1, ts, sig1);
    await registry.connect(buyer).submitListingWithSig(seller.address, uri2, ts + 1, sig2);
    expect(await registry.listingCount()).to.equal(3);
    const l1 = await registry.listings(1);
    const l2 = await registry.listings(2);
    expect(l1.uri).to.equal(uri1);
    expect(l2.uri).to.equal(uri2);
  });

  it("should allow seller to revoke their listing", async function () {
    const uri = "ipfs://QmRevoke";
    const ts = Math.floor(Date.now() / 1000);
    const sig = await seller.signTypedData(domain, types, { seller: seller.address, uri, timestamp: ts });
    const tx = await registry.connect(buyer).submitListingWithSig(seller.address, uri, ts, sig);
    const receipt = await tx.wait();
    const listingId = (await registry.listingCount()) - BigInt(1);

    const revokeTx = await registry.connect(seller).revokeListing(listingId);
    await expect(revokeTx).to.emit(registry, "ListingRevoked").withArgs(listingId, seller.address, await ts);
    const l = await registry.listings(listingId);
    expect(l.active).to.be.false;
  });

  it("should reject non-seller revoke attempt", async function () {
    const uri = "ipfs://QmNoAccess";
    const ts = Math.floor(Date.now() / 1000);
    const sig = await seller.signTypedData(domain, types, { seller: seller.address, uri, timestamp: ts });
    await registry.connect(buyer).submitListingWithSig(seller.address, uri, ts, sig);
    const listingId = (await registry.listingCount()) - BigInt(1);
    await expect(registry.connect(buyer).revokeListing(listingId)).to.be.revertedWith("Not your listing");
  });

  it("should allow owner to force revoke any listing", async function () {
    const uri = "ipfs://QmForceRevoke";
    const ts = Math.floor(Date.now() / 1000);
    const sig = await seller.signTypedData(domain, types, { seller: seller.address, uri, timestamp: ts });
    await registry.connect(buyer).submitListingWithSig(seller.address, uri, ts, sig);
    const listingId = (await registry.listingCount()) - BigInt(1);
    const forceTx = await registry.connect(owner).forceRevoke(listingId);
    await expect(forceTx).to.emit(registry, "ListingRevoked").withArgs(listingId, seller.address, await ts);
    const l = await registry.listings(listingId);
    expect(l.active).to.be.false;
  });

  it("should track seller and metadata accurately", async function () {
    const uri = "ipfs://QmMetaData/" + Math.random().toString(36).slice(2);
    const ts = Math.floor(Date.now() / 1000);
    const sig = await seller.signTypedData(domain, types, { seller: seller.address, uri, timestamp: ts });
    await registry.connect(buyer).submitListingWithSig(seller.address, uri, ts, sig);
    const listingId = (await registry.listingCount()) - BigInt(1);
    const l = await registry.listings(listingId);
    expect(l.seller).to.equal(seller.address);
    expect(l.uri).to.equal(uri);
    expect(l.timestamp).to.equal(ts);
    expect(l.active).to.be.true;
  });
});
