const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ListingRegistry", function () {
  let registry;
  let owner, seller, other;
  let chainId;

  const DOMAIN_NAME = "Nobay Listing";
  const TYPEHASH = ethers.keccak256(
    ethers.toUtf8Bytes("Listing(address seller,string uri,uint256 timestamp)")
  );

  before(async function () {
    [owner, seller, other] = await ethers.getSigners();
    chainId = (await ethers.provider.getNetwork()).chainId;

    const Registry = await ethers.getContractFactory("ListingRegistry");
    registry = await Registry.deploy();
    await registry.waitForDeployment();
  });

  // Helper: compute EIP-712 domain separator matching the contract
  function computeDomainSeparator(verifyingContract) {
    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "bytes32", "uint256", "address"],
        [
          ethers.keccak256(
            ethers.toUtf8Bytes(
              "EIP712Domain(string name,uint256 chainId,address verifyingContract)"
            )
          ),
          ethers.keccak256(ethers.toUtf8Bytes(DOMAIN_NAME)),
          chainId,
          verifyingContract,
        ]
      )
    );
  }

  // Helper: sign an EIP-712 listing payload using ethers TypedDataEncoder
  async function signListing(signer, sellerAddr, uri, timestamp, verifyingContract) {
    const domain = {
      name: DOMAIN_NAME,
      chainId: Number(chainId),
      verifyingContract: verifyingContract,
    };
    const types = {
      Listing: [
        { name: "seller", type: "address" },
        { name: "uri", type: "string" },
        { name: "timestamp", type: "uint256" },
      ],
    };
    const value = { seller: sellerAddr, uri, timestamp };
    return signer.signTypedData(domain, types, value);
  }

  describe("submitListingWithSig", function () {
    it("should verify a valid EIP-712 signature and create a listing", async function () {
      const uri = "ipfs://QmTest123";
      const timestamp = Math.floor(Date.now() / 1000);

      const signature = await signListing(
        seller,
        seller.address,
        uri,
        timestamp,
        await registry.getAddress()
      );

      const tx = await registry
        .connect(other) // anyone can submit
        .submitListingWithSig(seller.address, uri, timestamp, signature);

      const receipt = await tx.wait();

      // Check listing stored correctly
      const listing = await registry.listings(0);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.uri).to.equal(uri);
      expect(listing.timestamp).to.equal(timestamp);
      expect(listing.active).to.be.true;

      // Check counter
      expect(await registry.listingCount()).to.equal(1);

      // Check event emission
      await expect(tx)
        .to.emit(registry, "ListingVerified")
        .withArgs(0, seller.address, uri, timestamp);
    });

    it("should reject an invalid signature (wrong signer)", async function () {
      const uri = "ipfs://QmFake";
      const timestamp = Math.floor(Date.now() / 1000);

      // Sign with 'other' but submit as 'seller'
      const signature = await signListing(
        other,
        seller.address, // claims to be seller
        uri,
        timestamp,
        await registry.getAddress()
      );

      await expect(
        registry.submitListingWithSig(seller.address, uri, timestamp, signature)
      ).to.be.revertedWith("Invalid signature");
    });

    it("should reject tampered URI", async function () {
      const originalUri = "ipfs://QmOriginal";
      const tamperedUri = "ipfs://QmTampered";
      const timestamp = Math.floor(Date.now() / 1000);

      const signature = await signListing(
        seller,
        seller.address,
        originalUri,
        timestamp,
        await registry.getAddress()
      );

      // Submit with different URI
      await expect(
        registry.submitListingWithSig(seller.address, tamperedUri, timestamp, signature)
      ).to.be.revertedWith("Invalid signature");
    });

    it("should reject tampered timestamp", async function () {
      const uri = "ipfs://QmTest";
      const timestamp = Math.floor(Date.now() / 1000);

      const signature = await signListing(
        seller,
        seller.address,
        uri,
        timestamp,
        await registry.getAddress()
      );

      await expect(
        registry.submitListingWithSig(seller.address, uri, timestamp + 1, signature)
      ).to.be.revertedWith("Invalid signature");
    });

    it("should reject tampered seller address", async function () {
      const uri = "ipfs://QmTest";
      const timestamp = Math.floor(Date.now() / 1000);

      const signature = await signListing(
        seller,
        seller.address,
        uri,
        timestamp,
        await registry.getAddress()
      );

      await expect(
        registry.submitListingWithSig(other.address, uri, timestamp, signature)
      ).to.be.revertedWith("Invalid signature");
    });

    it("should reject empty signature", async function () {
      const uri = "ipfs://QmTest";
      const timestamp = Math.floor(Date.now() / 1000);

      await expect(
        registry.submitListingWithSig(seller.address, uri, timestamp, "0x")
      ).to.be.reverted;
    });

    it("should increment listingCount correctly across multiple listings", async function () {
      // Start from whatever listingCount is now
      const startCount = await registry.listingCount();

      for (let i = 0; i < 3; i++) {
        const uri = `ipfs://QmBatch${i}`;
        const timestamp = Math.floor(Date.now() / 1000) + i;
        const signature = await signListing(
          seller,
          seller.address,
          uri,
          timestamp,
          await registry.getAddress()
        );
        await registry
          .connect(other)
          .submitListingWithSig(seller.address, uri, timestamp, signature);
      }

      expect(await registry.listingCount()).to.equal(startCount + 3n);
    });

    it("should allow multiple sellers to create listings", async function () {
      const uri1 = "ipfs://QmSeller1";
      const uri2 = "ipfs://QmSeller2";
      const ts = Math.floor(Date.now() / 1000);

      const sig1 = await signListing(
        seller,
        seller.address,
        uri1,
        ts,
        await registry.getAddress()
      );
      const sig2 = await signListing(
        other,
        other.address,
        uri2,
        ts,
        await registry.getAddress()
      );

      await registry.submitListingWithSig(seller.address, uri1, ts, sig1);
      await registry.submitListingWithSig(other.address, uri2, ts, sig2);

      const count = await registry.listingCount();
      const l1 = await registry.listings(count - 2n);
      const l2 = await registry.listings(count - 1n);

      expect(l1.seller).to.equal(seller.address);
      expect(l2.seller).to.equal(other.address);
      expect(l1.uri).to.equal(uri1);
      expect(l2.uri).to.equal(uri2);
    });
  });

  describe("revokeListing", function () {
    let listingId;

    beforeEach(async function () {
      const uri = "ipfs://QmRevokeTest";
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await signListing(
        seller,
        seller.address,
        uri,
        timestamp,
        await registry.getAddress()
      );
      const tx = await registry.submitListingWithSig(
        seller.address, uri, timestamp, signature
      );
      const receipt = await tx.wait();
      listingId = (await registry.listingCount()) - 1n;
    });

    it("should allow seller to revoke their listing", async function () {
      const tx = registry.connect(seller).revokeListing(listingId);
      await expect(tx)
        .to.emit(registry, "ListingRevoked")
        .withArgs(listingId, seller.address, (v) => typeof v === "bigint");

      const listing = await registry.listings(listingId);
      expect(listing.active).to.be.false;
    });

    it("should reject revoke by non-seller", async function () {
      await expect(
        registry.connect(other).revokeListing(listingId)
      ).to.be.revertedWith("Not your listing");
    });

    it("should reject revoke of already inactive listing", async function () {
      await registry.connect(seller).revokeListing(listingId);
      await expect(
        registry.connect(seller).revokeListing(listingId)
      ).to.be.revertedWith("Already inactive");
    });
  });

  describe("forceRevoke", function () {
    let listingId;

    beforeEach(async function () {
      const uri = "ipfs://QmForceRevoke";
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await signListing(
        seller,
        seller.address,
        uri,
        timestamp,
        await registry.getAddress()
      );
      await registry.submitListingWithSig(
        seller.address, uri, timestamp, signature
      );
      listingId = (await registry.listingCount()) - 1n;
    });

    it("should allow owner to force-revoke any listing", async function () {
      const tx = registry.connect(owner).forceRevoke(listingId);
      await expect(tx)
        .to.emit(registry, "ListingRevoked")
        .withArgs(listingId, seller.address, (v) => typeof v === "bigint");

      const listing = await registry.listings(listingId);
      expect(listing.active).to.be.false;
    });

    it("should reject forceRevoke by non-owner", async function () {
      await expect(
        registry.connect(seller).forceRevoke(listingId)
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });

    it("should allow forceRevoke even after seller already revoked", async function () {
      await registry.connect(seller).revokeListing(listingId);
      // Should not revert — forceRevoke has no active check
      await registry.connect(owner).forceRevoke(listingId);
      const listing = await registry.listings(listingId);
      expect(listing.active).to.be.false;
    });
  });

  describe("Event emission accuracy", function () {
    it("should emit ListingVerified with correct metadata", async function () {
      const uri = "ipfs://QmEventTest";
      const timestamp = Math.floor(Date.now() / 1000);

      const signature = await signListing(
        seller,
        seller.address,
        uri,
        timestamp,
        await registry.getAddress()
      );

      const expectedId = await registry.listingCount();

      await expect(
        registry.submitListingWithSig(seller.address, uri, timestamp, signature)
      )
        .to.emit(registry, "ListingVerified")
        .withArgs(expectedId, seller.address, uri, timestamp);
    });

    it("should emit ListingRevoked on seller revoke", async function () {
      const uri = "ipfs://QmEventRevoke";
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await signListing(
        seller,
        seller.address,
        uri,
        timestamp,
        await registry.getAddress()
      );
      await registry.submitListingWithSig(seller.address, uri, timestamp, signature);
      const id = (await registry.listingCount()) - 1n;

      const tx = registry.connect(seller).revokeListing(id);
      await expect(tx)
        .to.emit(registry, "ListingRevoked")
        .withArgs(id, seller.address, (v) => typeof v === "bigint");
    });
  });

  describe("Metadata and seller mapping accuracy", function () {
    it("should store and return all listing fields correctly", async function () {
      const uri = "ipfs://QmMetadataTest";
      const timestamp = Math.floor(Date.now() / 1000);

      const signature = await signListing(
        seller,
        seller.address,
        uri,
        timestamp,
        await registry.getAddress()
      );

      await registry.submitListingWithSig(seller.address, uri, timestamp, signature);
      const id = (await registry.listingCount()) - 1n;
      const listing = await registry.listings(id);

      expect(listing.seller).to.equal(seller.address);
      expect(listing.uri).to.equal(uri);
      expect(listing.timestamp).to.equal(timestamp);
      expect(listing.active).to.be.true;
    });

    it("should preserve metadata after revocation", async function () {
      const uri = "ipfs://QmPreserved";
      const timestamp = Math.floor(Date.now() / 1000);

      const signature = await signListing(
        seller,
        seller.address,
        uri,
        timestamp,
        await registry.getAddress()
      );

      await registry.submitListingWithSig(seller.address, uri, timestamp, signature);
      const id = (await registry.listingCount()) - 1n;
      await registry.connect(seller).revokeListing(id);

      const listing = await registry.listings(id);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.uri).to.equal(uri);
      expect(listing.timestamp).to.equal(timestamp);
      expect(listing.active).to.be.false;
    });

    it("should store different URIs correctly for different listings", async function () {
      const uris = [
        "ipfs://QmAlpha",
        "ar://Bravo",
        "ipfs://QmCharlieDeltaEchoFoxtrot",
      ];
      const ts = Math.floor(Date.now() / 1000);

      for (const uri of uris) {
        const sig = await signListing(
          seller,
          seller.address,
          uri,
          ts,
          await registry.getAddress()
        );
        await registry.submitListingWithSig(seller.address, uri, ts, sig);
      }

      const count = await registry.listingCount();
      for (let i = 0; i < 3; i++) {
        const listing = await registry.listings(count - 3n + BigInt(i));
        expect(listing.uri).to.equal(uris[i]);
        expect(listing.seller).to.equal(seller.address);
      }
    });
  });
});

