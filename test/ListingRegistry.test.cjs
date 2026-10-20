const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ListingRegistry", function () {
  let registry;
  let owner, seller, buyer, attacker;
  let domain;

  const types = {
    Listing: [
      { name: "seller", type: "address" },
      { name: "uri", type: "string" },
      { name: "timestamp", type: "uint256" }
    ]
  };

  beforeEach(async function () {
    [owner, seller, buyer, attacker] = await ethers.getSigners();

    const ListingRegistryFactory = await ethers.getContractFactory("ListingRegistry");
    registry = await ListingRegistryFactory.deploy();
    await registry.waitForDeployment();

    const chainId = (await ethers.provider.getNetwork()).chainId;
    domain = {
      name: "Nobay Listing",
      chainId: chainId,
      verifyingContract: await registry.getAddress()
    };
  });

  describe("Deployment & Initial State", function () {
    it("Should set the deployer as owner", async function () {
      expect(await registry.owner()).to.equal(owner.address);
    });

    it("Should start with listingCount equal to 0", async function () {
      expect(await registry.listingCount()).to.equal(0);
    });

    it("Should have non-empty DOMAIN_SEPARATOR", async function () {
      const ds = await registry.DOMAIN_SEPARATOR();
      expect(ds).to.not.equal(ethers.ZeroHash);
    });
  });

  describe("submitListingWithSig (EIP-712 Verification)", function () {
    it("Should successfully submit a signed listing and emit ListingVerified", async function () {
      const uri = "ipfs://QmValidListingHash777";
      const timestamp = Math.floor(Date.now() / 1000);

      const value = {
        seller: seller.address,
        uri: uri,
        timestamp: timestamp
      };

      const signature = await seller.signTypedData(domain, types, value);

      await expect(
        registry.connect(buyer).submitListingWithSig(seller.address, uri, timestamp, signature)
      )
        .to.emit(registry, "ListingVerified")
        .withArgs(0, seller.address, uri, timestamp);

      expect(await registry.listingCount()).to.equal(1);

      const listing = await registry.listings(0);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.uri).to.equal(uri);
      expect(listing.timestamp).to.equal(timestamp);
      expect(listing.active).to.be.true;
    });

    it("Should reject listing if signed by an unauthorized party (invalid signature)", async function () {
      const uri = "ipfs://QmTamperedListing";
      const timestamp = Math.floor(Date.now() / 1000);

      const value = {
        seller: seller.address,
        uri: uri,
        timestamp: timestamp
      };

      // Attacker signs instead of seller
      const signature = await attacker.signTypedData(domain, types, value);

      await expect(
        registry.connect(attacker).submitListingWithSig(seller.address, uri, timestamp, signature)
      ).to.be.revertedWith("Invalid signature");
    });

    it("Should reject listing if parameters (URI) are altered after signing", async function () {
      const uri = "ipfs://QmOriginalHash";
      const alteredUri = "ipfs://QmAlteredHash";
      const timestamp = Math.floor(Date.now() / 1000);

      const value = {
        seller: seller.address,
        uri: uri,
        timestamp: timestamp
      };

      const signature = await seller.signTypedData(domain, types, value);

      // Caller passes alteredUri instead of signed uri
      await expect(
        registry.connect(buyer).submitListingWithSig(seller.address, alteredUri, timestamp, signature)
      ).to.be.revertedWith("Invalid signature");
    });

    it("Should increment listingCount for multiple valid submissions", async function () {
      const uri1 = "ipfs://QmHash1";
      const uri2 = "ipfs://QmHash2";
      const ts1 = 1700000001;
      const ts2 = 1700000002;

      const sig1 = await seller.signTypedData(domain, types, { seller: seller.address, uri: uri1, timestamp: ts1 });
      const sig2 = await seller.signTypedData(domain, types, { seller: seller.address, uri: uri2, timestamp: ts2 });

      await registry.submitListingWithSig(seller.address, uri1, ts1, sig1);
      await registry.submitListingWithSig(seller.address, uri2, ts2, sig2);

      expect(await registry.listingCount()).to.equal(2);
      expect((await registry.listings(0)).uri).to.equal(uri1);
      expect((await registry.listings(1)).uri).to.equal(uri2);
    });
  });

  describe("revokeListing (Seller)", function () {
    let listingId = 0;
    const uri = "ipfs://QmRevocableListing";
    const timestamp = 1700000100;

    beforeEach(async function () {
      const sig = await seller.signTypedData(domain, types, { seller: seller.address, uri, timestamp });
      const tx = await registry.submitListingWithSig(seller.address, uri, timestamp, sig);
      await tx.wait();
      listingId = 0;
    });

    it("Should allow the seller to revoke their active listing", async function () {
      await expect(registry.connect(seller).revokeListing(listingId))
        .to.emit(registry, "ListingRevoked");

      const listing = await registry.listings(listingId);
      expect(listing.active).to.be.false;
    });

    it("Should revert if a non-seller tries to revoke", async function () {
      await expect(
        registry.connect(attacker).revokeListing(listingId)
      ).to.be.revertedWith("Not your listing");
    });

    it("Should revert if trying to revoke an already inactive listing", async function () {
      await registry.connect(seller).revokeListing(listingId);

      await expect(
        registry.connect(seller).revokeListing(listingId)
      ).to.be.revertedWith("Already inactive");
    });
  });

  describe("forceRevoke (DAO Emergency)", function () {
    let listingId = 0;
    const uri = "ipfs://QmDisputedListing";
    const timestamp = 1700000200;

    beforeEach(async function () {
      const sig = await seller.signTypedData(domain, types, { seller: seller.address, uri, timestamp });
      await registry.submitListingWithSig(seller.address, uri, timestamp, sig);
      listingId = 0;
    });

    it("Should allow contract owner to forceRevoke any listing", async function () {
      await expect(registry.connect(owner).forceRevoke(listingId))
        .to.emit(registry, "ListingRevoked");

      const listing = await registry.listings(listingId);
      expect(listing.active).to.be.false;
    });

    it("Should revert if non-owner tries to forceRevoke", async function () {
      await expect(
        registry.connect(attacker).forceRevoke(listingId)
      ).to.be.reverted;
    });
  });
});
