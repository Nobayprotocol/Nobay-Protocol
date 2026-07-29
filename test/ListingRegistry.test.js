const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ListingRegistry", function () {
  let ListingRegistry;
  let registry;
  let owner, seller, attacker;
  let domain, types;

  before(async function () {
    [owner, seller, attacker] = await ethers.getSigners();
  });

  beforeEach(async function () {
    ListingRegistry = await ethers.getContractFactory("ListingRegistry");
    registry = await ListingRegistry.deploy();
    await registry.waitForDeployment();

    domain = {
      name: "Nobay Listing",
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

  describe("Signature Verification", function () {
    it("should accept a valid EIP-712 signature", async function () {
      const uri = "ipfs://QmTest123";
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await seller.signTypedData(domain, types, {
        seller: seller.address,
        uri: uri,
        timestamp: timestamp,
      });

      const tx = await registry.submitListingWithSig(
        seller.address,
        uri,
        timestamp,
        signature
      );
      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);
    });

    it("should store listing metadata correctly", async function () {
      const uri = "ipfs://QmTest456";
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await seller.signTypedData(domain, types, {
        seller: seller.address,
        uri: uri,
        timestamp: timestamp,
      });

      await registry.submitListingWithSig(
        seller.address,
        uri,
        timestamp,
        signature
      );

      const listing = await registry.listings(0);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.uri).to.equal(uri);
      expect(listing.timestamp).to.equal(timestamp);
      expect(listing.active).to.equal(true);
    });

    it("should reject a signature signed by a different account", async function () {
      const uri = "ipfs://QmTest789";
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await seller.signTypedData(domain, types, {
        seller: seller.address,
        uri: uri,
        timestamp: timestamp,
      });

      await expect(
        registry.submitListingWithSig(attacker.address, uri, timestamp, signature)
      ).to.be.revertedWith("Invalid signature");
    });

    it("should reject a replayed signature with wrong data", async function () {
      const uri1 = "ipfs://QmTest111";
      const uri2 = "ipfs://QmTest222";
      const timestamp = Math.floor(Date.now() / 1000);

      const signature = await seller.signTypedData(domain, types, {
        seller: seller.address,
        uri: uri1,
        timestamp: timestamp,
      });

      await expect(
        registry.submitListingWithSig(seller.address, uri2, timestamp, signature)
      ).to.be.revertedWith("Invalid signature");
    });

    it("should reject an empty signature", async function () {
      const uri = "ipfs://QmTest333";
      const timestamp = Math.floor(Date.now() / 1000);

      await expect(
        registry.submitListingWithSig(seller.address, uri, timestamp, "0x")
      ).to.be.revertedWith("ECDSA: invalid signature length");
    });

    it("should reject signature with modified seller address", async function () {
      const uri = "ipfs://QmTest444";
      const timestamp = Math.floor(Date.now() / 1000);

      const sig2 = await attacker.signTypedData(domain, types, {
        seller: attacker.address,
        uri: uri,
        timestamp: timestamp,
      });

      await expect(
        registry.submitListingWithSig(seller.address, uri, timestamp, sig2)
      ).to.be.revertedWith("Invalid signature");
    });
  });

  describe("Event Emission", function () {
    it("should emit ListingVerified on successful submission", async function () {
      const uri = "ipfs://QmEvent1";
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await seller.signTypedData(domain, types, {
        seller: seller.address,
        uri: uri,
        timestamp: timestamp,
      });

      const tx = await registry.submitListingWithSig(seller.address, uri, timestamp, signature);
      const receipt = await tx.wait();

      // Verify event was emitted
      const event = receipt.logs.find(l => l.fragment?.name === "ListingVerified");
      expect(event).to.not.be.undefined;
      const [listingId, sellerAddr, uriVal, ts] = event.args;
      expect(listingId).to.equal(0n);
      expect(sellerAddr).to.equal(seller.address);
      expect(uriVal).to.equal(uri);
      expect(ts).to.equal(timestamp);
    });

    it("should emit ListingRevoked on revokeListing", async function () {
      const uri = "ipfs://QmEvent2";
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await seller.signTypedData(domain, types, {
        seller: seller.address,
        uri: uri,
        timestamp: timestamp,
      });

      await registry.submitListingWithSig(seller.address, uri, timestamp, signature);

      const tx = await registry.connect(seller).revokeListing(0);
      const receipt = await tx.wait();

      // Contract emits ListingRevoked(listingId, seller, block.timestamp)
      const event = receipt.logs.find(l => l.fragment?.name === "ListingRevoked");
      expect(event).to.not.be.undefined;
      const [listingId, sellerAddr] = event.args;
      expect(listingId).to.equal(0n);
      expect(sellerAddr).to.equal(seller.address);
    });

    it("should emit ListingRevoked on forceRevoke by owner", async function () {
      const uri = "ipfs://QmEvent3";
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await seller.signTypedData(domain, types, {
        seller: seller.address,
        uri: uri,
        timestamp: timestamp,
      });

      await registry.submitListingWithSig(seller.address, uri, timestamp, signature);

      const tx = await registry.forceRevoke(0);
      const receipt = await tx.wait();

      const event = receipt.logs.find(l => l.fragment?.name === "ListingRevoked");
      expect(event).to.not.be.undefined;
      const [listingId, sellerAddr] = event.args;
      expect(listingId).to.equal(0n);
      expect(sellerAddr).to.equal(seller.address);
    });
  });

  describe("Revoke Functionality", function () {
    it("should allow seller to revoke their listing", async function () {
      const uri = "ipfs://QmRevoke1";
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await seller.signTypedData(domain, types, {
        seller: seller.address,
        uri: uri,
        timestamp: timestamp,
      });

      await registry.submitListingWithSig(seller.address, uri, timestamp, signature);
      await registry.connect(seller).revokeListing(0);

      const listing = await registry.listings(0);
      expect(listing.active).to.equal(false);
    });

    it("should reject revoke by non-seller", async function () {
      const uri = "ipfs://QmRevoke2";
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await seller.signTypedData(domain, types, {
        seller: seller.address,
        uri: uri,
        timestamp: timestamp,
      });

      await registry.submitListingWithSig(seller.address, uri, timestamp, signature);

      await expect(
        registry.connect(attacker).revokeListing(0)
      ).to.be.revertedWith("Not your listing");
    });

    it("should reject double revoke", async function () {
      const uri = "ipfs://QmRevoke3";
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await seller.signTypedData(domain, types, {
        seller: seller.address,
        uri: uri,
        timestamp: timestamp,
      });

      await registry.submitListingWithSig(seller.address, uri, timestamp, signature);
      await registry.connect(seller).revokeListing(0);

      await expect(
        registry.connect(seller).revokeListing(0)
      ).to.be.revertedWith("Already inactive");
    });
  });

  describe("Owner Functions", function () {
    it("should allow owner to force revoke any listing", async function () {
      const uri = "ipfs://QmForce1";
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await seller.signTypedData(domain, types, {
        seller: seller.address,
        uri: uri,
        timestamp: timestamp,
      });

      await registry.submitListingWithSig(seller.address, uri, timestamp, signature);
      await registry.forceRevoke(0);

      const listing = await registry.listings(0);
      expect(listing.active).to.equal(false);
    });

    it("should reject force revoke by non-owner", async function () {
      const uri = "ipfs://QmForce2";
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await seller.signTypedData(domain, types, {
        seller: seller.address,
        uri: uri,
        timestamp: timestamp,
      });

      await registry.submitListingWithSig(seller.address, uri, timestamp, signature);

      await expect(
        registry.connect(seller).forceRevoke(0)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Listing Count", function () {
    it("should increment listingCount on each submission", async function () {
      const uri1 = "ipfs://QmCount1";
      const uri2 = "ipfs://QmCount2";
      const timestamp = Math.floor(Date.now() / 1000);

      const sig1 = await seller.signTypedData(domain, types, {
        seller: seller.address, uri: uri1, timestamp
      });
      const sig2 = await seller.signTypedData(domain, types, {
        seller: seller.address, uri: uri2, timestamp
      });

      await registry.submitListingWithSig(seller.address, uri1, timestamp, sig1);
      expect(await registry.listingCount()).to.equal(1);

      await registry.submitListingWithSig(seller.address, uri2, timestamp, sig2);
      expect(await registry.listingCount()).to.equal(2);
    });
  });
});
