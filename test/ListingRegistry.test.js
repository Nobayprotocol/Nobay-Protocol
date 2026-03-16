// SPDX-License-Identifier: MIT
const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("ListingRegistry", () => {
  let registry;
  let owner, seller1, seller2;
  let domain;
  const types = {
    Listing: [
      { name: "seller", type: "address" },
      { name: "uri", type: "string" },
      { name: "timestamp", type: "uint256" },
    ],
  };

  beforeEach(async () => {
    [owner, seller1, seller2] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("ListingRegistry");
    registry = await Factory.deploy();
    await registry.waitForDeployment();

    const chainId = (await ethers.provider.getNetwork()).chainId;
    domain = {
      name: "Nobay Listing",
      chainId: chainId,
      verifyingContract: await registry.getAddress(),
    };
  });

  // Helper: sign a listing with EIP-712
  async function signListing(signer, seller, uri, timestamp) {
    return signer.signTypedData(domain, types, { seller, uri, timestamp });
  }

  // ─── Signature Validity ──────────────────────────────────────────

  describe("Signature validity", () => {
    it("should accept a valid EIP-712 signature from the seller", async () => {
      const uri = "QmValidHash";
      const ts = Math.floor(Date.now() / 1000);
      const sig = await signListing(seller1, seller1.address, uri, ts);

      const tx = await registry.submitListingWithSig(seller1.address, uri, ts, sig);
      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);

      const listing = await registry.listings(0);
      expect(listing.seller).to.equal(seller1.address);
      expect(listing.uri).to.equal(uri);
      expect(listing.timestamp).to.equal(ts);
      expect(listing.active).to.equal(true);
    });

    it("should accept signatures from different sellers", async () => {
      const uri1 = "QmSeller1";
      const uri2 = "QmSeller2";
      const ts = Math.floor(Date.now() / 1000);

      const sig1 = await signListing(seller1, seller1.address, uri1, ts);
      const sig2 = await signListing(seller2, seller2.address, uri2, ts);

      await registry.submitListingWithSig(seller1.address, uri1, ts, sig1);
      await registry.submitListingWithSig(seller2.address, uri2, ts, sig2);

      expect((await registry.listings(0)).seller).to.equal(seller1.address);
      expect((await registry.listings(1)).seller).to.equal(seller2.address);
      expect(await registry.listingCount()).to.equal(2);
    });

    it("should return the correct listing ID", async () => {
      const ts = Math.floor(Date.now() / 1000);
      const sig = await signListing(seller1, seller1.address, "QmFirst", ts);

      // First listing should be ID 0
      await expect(registry.submitListingWithSig(seller1.address, "QmFirst", ts, sig))
        .to.emit(registry, "ListingVerified")
        .withArgs(0, seller1.address, "QmFirst", ts);

      // Second listing should be ID 1
      const ts2 = ts + 1;
      const sig2 = await signListing(seller1, seller1.address, "QmSecond", ts2);
      await expect(registry.submitListingWithSig(seller1.address, "QmSecond", ts2, sig2))
        .to.emit(registry, "ListingVerified")
        .withArgs(1, seller1.address, "QmSecond", ts2);
    });
  });

  // ─── Rejection of Invalid Signatures ─────────────────────────────

  describe("Rejection of invalid signatures", () => {
    it("should reject signature from wrong signer", async () => {
      const uri = "QmTest";
      const ts = Math.floor(Date.now() / 1000);
      // seller2 signs but claims to be seller1
      const sig = await signListing(seller2, seller1.address, uri, ts);

      await expect(
        registry.submitListingWithSig(seller1.address, uri, ts, sig)
      ).to.be.revertedWith("Invalid signature");
    });

    it("should reject signature with tampered URI", async () => {
      const ts = Math.floor(Date.now() / 1000);
      // Sign with one URI, submit with another
      const sig = await signListing(seller1, seller1.address, "QmOriginal", ts);

      await expect(
        registry.submitListingWithSig(seller1.address, "QmTampered", ts, sig)
      ).to.be.revertedWith("Invalid signature");
    });

    it("should reject signature with tampered timestamp", async () => {
      const ts = Math.floor(Date.now() / 1000);
      const sig = await signListing(seller1, seller1.address, "QmTest", ts);

      await expect(
        registry.submitListingWithSig(seller1.address, "QmTest", ts + 100, sig)
      ).to.be.revertedWith("Invalid signature");
    });

    it("should reject signature with tampered seller address", async () => {
      const ts = Math.floor(Date.now() / 1000);
      // seller1 signs for seller1, but submission claims seller2
      const sig = await signListing(seller1, seller1.address, "QmTest", ts);

      await expect(
        registry.submitListingWithSig(seller2.address, "QmTest", ts, sig)
      ).to.be.revertedWith("Invalid signature");
    });

    it("should reject completely invalid signature bytes", async () => {
      const ts = Math.floor(Date.now() / 1000);
      const invalidSig = "0x" + "ab".repeat(65);

      await expect(
        registry.submitListingWithSig(seller1.address, "QmTest", ts, invalidSig)
      ).to.be.reverted;
    });

    it("should reject empty signature", async () => {
      const ts = Math.floor(Date.now() / 1000);

      await expect(
        registry.submitListingWithSig(seller1.address, "QmTest", ts, "0x")
      ).to.be.reverted;
    });
  });

  // ─── Event Emission ──────────────────────────────────────────────

  describe("Event emission", () => {
    it("should emit ListingVerified on successful submission", async () => {
      const uri = "QmEventTest";
      const ts = Math.floor(Date.now() / 1000);
      const sig = await signListing(seller1, seller1.address, uri, ts);

      await expect(registry.submitListingWithSig(seller1.address, uri, ts, sig))
        .to.emit(registry, "ListingVerified")
        .withArgs(0, seller1.address, uri, ts);
    });

    it("should emit ListingRevoked when seller revokes", async () => {
      const uri = "QmRevokeTest";
      const ts = Math.floor(Date.now() / 1000);
      const sig = await signListing(seller1, seller1.address, uri, ts);
      await registry.submitListingWithSig(seller1.address, uri, ts, sig);

      await expect(registry.connect(seller1).revokeListing(0))
        .to.emit(registry, "ListingRevoked")
        .withArgs(0, seller1.address, () => true); // timestamp is block.timestamp
    });

    it("should emit ListingRevoked when owner force-revokes", async () => {
      const uri = "QmForceRevokeTest";
      const ts = Math.floor(Date.now() / 1000);
      const sig = await signListing(seller1, seller1.address, uri, ts);
      await registry.submitListingWithSig(seller1.address, uri, ts, sig);

      await expect(registry.connect(owner).forceRevoke(0))
        .to.emit(registry, "ListingRevoked");
    });

    it("should emit events with correct listing IDs for multiple listings", async () => {
      const ts = Math.floor(Date.now() / 1000);

      const sig0 = await signListing(seller1, seller1.address, "QmA", ts);
      const sig1 = await signListing(seller1, seller1.address, "QmB", ts + 1);
      const sig2 = await signListing(seller2, seller2.address, "QmC", ts + 2);

      await expect(registry.submitListingWithSig(seller1.address, "QmA", ts, sig0))
        .to.emit(registry, "ListingVerified").withArgs(0, seller1.address, "QmA", ts);

      await expect(registry.submitListingWithSig(seller1.address, "QmB", ts + 1, sig1))
        .to.emit(registry, "ListingVerified").withArgs(1, seller1.address, "QmB", ts + 1);

      await expect(registry.submitListingWithSig(seller2.address, "QmC", ts + 2, sig2))
        .to.emit(registry, "ListingVerified").withArgs(2, seller2.address, "QmC", ts + 2);
    });
  });

  // ─── Seller Mapping and Metadata Accuracy ────────────────────────

  describe("Seller mapping and metadata accuracy", () => {
    it("should store seller address correctly", async () => {
      const ts = Math.floor(Date.now() / 1000);
      const sig = await signListing(seller1, seller1.address, "QmTest", ts);
      await registry.submitListingWithSig(seller1.address, "QmTest", ts, sig);

      expect((await registry.listings(0)).seller).to.equal(seller1.address);
    });

    it("should store URI correctly", async () => {
      const uri = "QmWhateverLongHashValueGoesHere12345";
      const ts = Math.floor(Date.now() / 1000);
      const sig = await signListing(seller1, seller1.address, uri, ts);
      await registry.submitListingWithSig(seller1.address, uri, ts, sig);

      expect((await registry.listings(0)).uri).to.equal(uri);
    });

    it("should store timestamp correctly", async () => {
      const ts = 1700000000;
      const sig = await signListing(seller1, seller1.address, "QmTest", ts);
      await registry.submitListingWithSig(seller1.address, "QmTest", ts, sig);

      expect((await registry.listings(0)).timestamp).to.equal(ts);
    });

    it("should set active to true on creation", async () => {
      const ts = Math.floor(Date.now() / 1000);
      const sig = await signListing(seller1, seller1.address, "QmTest", ts);
      await registry.submitListingWithSig(seller1.address, "QmTest", ts, sig);

      expect((await registry.listings(0)).active).to.equal(true);
    });

    it("should set active to false after revocation", async () => {
      const ts = Math.floor(Date.now() / 1000);
      const sig = await signListing(seller1, seller1.address, "QmTest", ts);
      await registry.submitListingWithSig(seller1.address, "QmTest", ts, sig);

      await registry.connect(seller1).revokeListing(0);
      expect((await registry.listings(0)).active).to.equal(false);
    });

    it("should increment listingCount after each submission", async () => {
      expect(await registry.listingCount()).to.equal(0);

      const ts = Math.floor(Date.now() / 1000);
      const sig1 = await signListing(seller1, seller1.address, "Qm1", ts);
      await registry.submitListingWithSig(seller1.address, "Qm1", ts, sig1);
      expect(await registry.listingCount()).to.equal(1);

      const sig2 = await signListing(seller1, seller1.address, "Qm2", ts + 1);
      await registry.submitListingWithSig(seller1.address, "Qm2", ts + 1, sig2);
      expect(await registry.listingCount()).to.equal(2);
    });
  });

  // ─── Access Control ──────────────────────────────────────────────

  describe("Access control", () => {
    let ts, sig;

    beforeEach(async () => {
      ts = Math.floor(Date.now() / 1000);
      sig = await signListing(seller1, seller1.address, "QmAccess", ts);
      await registry.submitListingWithSig(seller1.address, "QmAccess", ts, sig);
    });

    it("should allow seller to revoke their own listing", async () => {
      await registry.connect(seller1).revokeListing(0);
      expect((await registry.listings(0)).active).to.equal(false);
    });

    it("should reject revocation from non-seller", async () => {
      await expect(
        registry.connect(seller2).revokeListing(0)
      ).to.be.revertedWith("Not your listing");
    });

    it("should reject revocation of already-revoked listing", async () => {
      await registry.connect(seller1).revokeListing(0);
      await expect(
        registry.connect(seller1).revokeListing(0)
      ).to.be.revertedWith("Already inactive");
    });

    it("should allow owner to force-revoke any listing", async () => {
      await registry.connect(owner).forceRevoke(0);
      expect((await registry.listings(0)).active).to.equal(false);
    });

    it("should reject force-revoke from non-owner", async () => {
      await expect(
        registry.connect(seller1).forceRevoke(0)
      ).to.be.reverted; // OwnableUnauthorizedAccount in OZ v5
    });

    it("should allow owner to force-revoke even after seller revokes", async () => {
      await registry.connect(seller1).revokeListing(0);
      // forceRevoke doesn't check active flag — sets it to false again (idempotent)
      await registry.connect(owner).forceRevoke(0);
      expect((await registry.listings(0)).active).to.equal(false);
    });
  });

  // ─── Edge Cases ──────────────────────────────────────────────────

  describe("Edge cases", () => {
    it("should handle empty URI string", async () => {
      const ts = Math.floor(Date.now() / 1000);
      const sig = await signListing(seller1, seller1.address, "", ts);
      await registry.submitListingWithSig(seller1.address, "", ts, sig);

      expect((await registry.listings(0)).uri).to.equal("");
    });

    it("should handle zero timestamp", async () => {
      const sig = await signListing(seller1, seller1.address, "QmZero", 0);
      await registry.submitListingWithSig(seller1.address, "QmZero", 0, sig);

      expect((await registry.listings(0)).timestamp).to.equal(0);
    });

    it("should handle very long URI string", async () => {
      const longUri = "Qm" + "a".repeat(500);
      const ts = Math.floor(Date.now() / 1000);
      const sig = await signListing(seller1, seller1.address, longUri, ts);
      await registry.submitListingWithSig(seller1.address, longUri, ts, sig);

      expect((await registry.listings(0)).uri).to.equal(longUri);
    });

    it("should handle max uint256 timestamp", async () => {
      const maxTs = ethers.MaxUint256;
      const sig = await signListing(seller1, seller1.address, "QmMax", maxTs);
      await registry.submitListingWithSig(seller1.address, "QmMax", maxTs, sig);

      expect((await registry.listings(0)).timestamp).to.equal(maxTs);
    });

    it("should allow same seller to create multiple listings", async () => {
      const ts = Math.floor(Date.now() / 1000);

      for (let i = 0; i < 5; i++) {
        const uri = `QmMulti${i}`;
        const sig = await signListing(seller1, seller1.address, uri, ts + i);
        await registry.submitListingWithSig(seller1.address, uri, ts + i, sig);
      }

      expect(await registry.listingCount()).to.equal(5);
      for (let i = 0; i < 5; i++) {
        expect((await registry.listings(i)).seller).to.equal(seller1.address);
        expect((await registry.listings(i)).uri).to.equal(`QmMulti${i}`);
      }
    });

    it("should allow anyone to call submitListingWithSig (not just seller)", async () => {
      const ts = Math.floor(Date.now() / 1000);
      // seller1 signs, but seller2 submits the transaction
      const sig = await signListing(seller1, seller1.address, "QmRelay", ts);
      await registry.connect(seller2).submitListingWithSig(seller1.address, "QmRelay", ts, sig);

      expect((await registry.listings(0)).seller).to.equal(seller1.address);
    });
  });
});
