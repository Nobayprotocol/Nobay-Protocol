const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ListingRegistry", function () {
  let ListingRegistry;
  let registry;
  let owner;
  let seller;
  let other;
  let chainId;
  let sellerWallet;
  let otherWallet;

  // EIP-712 domain
  const DOMAIN_NAME = "Nobay Listing";

  // EIP-712 type hash
  const TYPEHASH = ethers.keccak256(
    ethers.toUtf8Bytes("Listing(address seller,string uri,uint256 timestamp)")
  );

  // Hardhat default accounts private keys
  const PRIVATE_KEYS = [
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  ];

  beforeEach(async function () {
    [owner, seller, other] = await ethers.getSigners();

    // Create wallets with private keys for signing
    sellerWallet = new ethers.Wallet(PRIVATE_KEYS[1]);
    otherWallet = new ethers.Wallet(PRIVATE_KEYS[2]);

    ListingRegistry = await ethers.getContractFactory("ListingRegistry");
    registry = await ListingRegistry.deploy();
    await registry.waitForDeployment();

    chainId = (await ethers.provider.getNetwork()).chainId;
  });

  describe("Deployment", function () {
    it("should set the deployer as owner", async function () {
      expect(await registry.owner()).to.equal(owner.address);
    });

    it("should initialize listingCount to 0", async function () {
      expect(await registry.listingCount()).to.equal(0);
    });

    it("should set DOMAIN_SEPARATOR correctly", async function () {
      const expectedDomain = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["bytes32", "bytes32", "uint256", "address"],
          [
            ethers.keccak256(
              ethers.toUtf8Bytes("EIP712Domain(string name,uint256 chainId,address verifyingContract)")
            ),
            ethers.keccak256(ethers.toUtf8Bytes(DOMAIN_NAME)),
            chainId,
            await registry.getAddress(),
          ]
        )
      );
      expect(await registry.DOMAIN_SEPARATOR()).to.equal(expectedDomain);
    });
  });

  describe("Signature Validity", function () {
    it("should accept valid EIP-712 signature", async function () {
      const uri = "ipfs://QmTest123";
      const timestamp = Math.floor(Date.now() / 1000);

      // Create EIP-712 digest
      const digest = await createDigest(seller.address, uri, timestamp);

      // Sign with seller's private key (raw signature, no prefix)
      const signature = sellerWallet.signingKey.sign(digest).serialized;

      // Submit listing
      await expect(
        registry.submitListingWithSig(seller.address, uri, timestamp, signature)
      ).to.emit(registry, "ListingVerified");

      // Verify listing stored correctly
      const listing = await registry.listings(0);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.uri).to.equal(uri);
      expect(listing.timestamp).to.equal(timestamp);
      expect(listing.active).to.be.true;
    });

    it("should increment listingCount after valid submission", async function () {
      const uri = "ipfs://QmTest456";
      const timestamp = Math.floor(Date.now() / 1000);

      const digest = await createDigest(seller.address, uri, timestamp);
      const signature = sellerWallet.signingKey.sign(digest).serialized;

      await registry.submitListingWithSig(seller.address, uri, timestamp, signature);
      expect(await registry.listingCount()).to.equal(1);

      // Submit another listing
      const uri2 = "ipfs://QmTest789";
      const timestamp2 = timestamp + 1;
      const digest2 = await createDigest(seller.address, uri2, timestamp2);
      const signature2 = sellerWallet.signingKey.sign(digest2).serialized;

      await registry.submitListingWithSig(seller.address, uri2, timestamp2, signature2);
      expect(await registry.listingCount()).to.equal(2);
    });

    it("should return correct listingId", async function () {
      const uri = "ipfs://QmTestReturn";
      const timestamp = Math.floor(Date.now() / 1000);

      const digest = await createDigest(seller.address, uri, timestamp);
      const signature = sellerWallet.signingKey.sign(digest).serialized;

      // Get current listing count
      const currentCount = await registry.listingCount();

      // Check the return value via static call
      const listingId = await registry.submitListingWithSig.staticCall(
        seller.address,
        uri,
        timestamp,
        signature
      );
      expect(listingId).to.equal(currentCount);
    });
  });

  describe("Rejection of Invalid Signatures", function () {
    it("should reject signature from wrong signer", async function () {
      const uri = "ipfs://QmWrongSigner";
      const timestamp = Math.floor(Date.now() / 1000);

      // Sign with 'other' instead of 'seller'
      const digest = await createDigest(seller.address, uri, timestamp);
      const signature = otherWallet.signingKey.sign(digest).serialized;

      await expect(
        registry.submitListingWithSig(seller.address, uri, timestamp, signature)
      ).to.be.revertedWith("Invalid signature");
    });

    it("should reject tampered URI", async function () {
      const uri = "ipfs://QmOriginal";
      const tamperedUri = "ipfs://QmTampered";
      const timestamp = Math.floor(Date.now() / 1000);

      const digest = await createDigest(seller.address, uri, timestamp);
      const signature = sellerWallet.signingKey.sign(digest).serialized;

      await expect(
        registry.submitListingWithSig(seller.address, tamperedUri, timestamp, signature)
      ).to.be.revertedWith("Invalid signature");
    });

    it("should reject tampered timestamp", async function () {
      const uri = "ipfs://QmTimestamp";
      const timestamp = Math.floor(Date.now() / 1000);
      const tamperedTimestamp = timestamp + 1000;

      const digest = await createDigest(seller.address, uri, timestamp);
      const signature = sellerWallet.signingKey.sign(digest).serialized;

      await expect(
        registry.submitListingWithSig(seller.address, uri, tamperedTimestamp, signature)
      ).to.be.revertedWith("Invalid signature");
    });

    it("should reject tampered seller address", async function () {
      const uri = "ipfs://QmSeller";
      const timestamp = Math.floor(Date.now() / 1000);

      const digest = await createDigest(seller.address, uri, timestamp);
      const signature = sellerWallet.signingKey.sign(digest).serialized;

      await expect(
        registry.submitListingWithSig(other.address, uri, timestamp, signature)
      ).to.be.revertedWith("Invalid signature");
    });

    it("should reject empty signature", async function () {
      const uri = "ipfs://QmEmpty";
      const timestamp = Math.floor(Date.now() / 1000);

      await expect(
        registry.submitListingWithSig(seller.address, uri, timestamp, "0x")
      ).to.be.reverted;
    });

    it("should reject garbage signature", async function () {
      const uri = "ipfs://QmGarbage";
      const timestamp = Math.floor(Date.now() / 1000);

      const garbageSig = "0x" + "aa".repeat(65);

      await expect(
        registry.submitListingWithSig(seller.address, uri, timestamp, garbageSig)
      ).to.be.reverted;
    });
  });

  describe("Event Emission", function () {
    it("should emit ListingVerified with correct parameters", async function () {
      const uri = "ipfs://QmEventTest";
      const timestamp = Math.floor(Date.now() / 1000);

      const digest = await createDigest(seller.address, uri, timestamp);
      const signature = sellerWallet.signingKey.sign(digest).serialized;

      await expect(registry.submitListingWithSig(seller.address, uri, timestamp, signature))
        .to.emit(registry, "ListingVerified")
        .withArgs(0, seller.address, uri, timestamp);
    });

    it("should emit ListingRevoked on revoke", async function () {
      // First create a listing
      const uri = "ipfs://QmRevokeEvent";
      const timestamp = Math.floor(Date.now() / 1000);

      const digest = await createDigest(seller.address, uri, timestamp);
      const signature = sellerWallet.signingKey.sign(digest).serialized;

      await registry.submitListingWithSig(seller.address, uri, timestamp, signature);

      // Revoke and check event was emitted
      await expect(registry.connect(seller).revokeListing(0))
        .to.emit(registry, "ListingRevoked");
    });

    it("should emit ListingRevoked on forceRevoke", async function () {
      // Create listing
      const uri = "ipfs://QmForceRevoke";
      const timestamp = Math.floor(Date.now() / 1000);

      const digest = await createDigest(seller.address, uri, timestamp);
      const signature = sellerWallet.signingKey.sign(digest).serialized;

      await registry.submitListingWithSig(seller.address, uri, timestamp, signature);

      // Force revoke by owner
      await expect(registry.connect(owner).forceRevoke(0))
        .to.emit(registry, "ListingRevoked");
    });
  });

  describe("Seller Mapping and Metadata Accuracy", function () {
    it("should store correct seller address", async function () {
      const uri = "ipfs://QmSellerMapping";
      const timestamp = Math.floor(Date.now() / 1000);

      const digest = await createDigest(seller.address, uri, timestamp);
      const signature = sellerWallet.signingKey.sign(digest).serialized;

      await registry.submitListingWithSig(seller.address, uri, timestamp, signature);

      const listing = await registry.listings(0);
      expect(listing.seller).to.equal(seller.address);
    });

    it("should store correct URI", async function () {
      const uri = "ipfs://QmMetadataTest";
      const timestamp = Math.floor(Date.now() / 1000);

      const digest = await createDigest(seller.address, uri, timestamp);
      const signature = sellerWallet.signingKey.sign(digest).serialized;

      await registry.submitListingWithSig(seller.address, uri, timestamp, signature);

      const listing = await registry.listings(0);
      expect(listing.uri).to.equal(uri);
    });

    it("should store correct timestamp", async function () {
      const uri = "ipfs://QmTimestampTest";
      const timestamp = Math.floor(Date.now() / 1000);

      const digest = await createDigest(seller.address, uri, timestamp);
      const signature = sellerWallet.signingKey.sign(digest).serialized;

      await registry.submitListingWithSig(seller.address, uri, timestamp, signature);

      const listing = await registry.listings(0);
      expect(listing.timestamp).to.equal(timestamp);
    });

    it("should set active to true on creation", async function () {
      const uri = "ipfs://QmActiveTest";
      const timestamp = Math.floor(Date.now() / 1000);

      const digest = await createDigest(seller.address, uri, timestamp);
      const signature = sellerWallet.signingKey.sign(digest).serialized;

      await registry.submitListingWithSig(seller.address, uri, timestamp, signature);

      const listing = await registry.listings(0);
      expect(listing.active).to.be.true;
    });

    it("should handle multiple listings from same seller", async function () {
      for (let i = 0; i < 3; i++) {
        const uri = `ipfs://QmMulti${i}`;
        const timestamp = Math.floor(Date.now() / 1000) + i;

        const digest = await createDigest(seller.address, uri, timestamp);
        const signature = sellerWallet.signingKey.sign(digest).serialized;

        await registry.submitListingWithSig(seller.address, uri, timestamp, signature);
      }

      expect(await registry.listingCount()).to.equal(3);

      for (let i = 0; i < 3; i++) {
        const listing = await registry.listings(i);
        expect(listing.seller).to.equal(seller.address);
        expect(listing.uri).to.equal(`ipfs://QmMulti${i}`);
        expect(listing.active).to.be.true;
      }
    });

    it("should handle listings from different sellers", async function () {
      const wallets = [sellerWallet, otherWallet];
      const sellers = [seller, other];
      for (let i = 0; i < sellers.length; i++) {
        const uri = `ipfs://QmDiffSeller${i}`;
        const timestamp = Math.floor(Date.now() / 1000) + i;

        const digest = await createDigest(sellers[i].address, uri, timestamp);
        const signature = wallets[i].signingKey.sign(digest).serialized;

        await registry.submitListingWithSig(sellers[i].address, uri, timestamp, signature);
      }

      const listing0 = await registry.listings(0);
      const listing1 = await registry.listings(1);

      expect(listing0.seller).to.equal(seller.address);
      expect(listing1.seller).to.equal(other.address);
    });
  });

  describe("Revoke Listing", function () {
    it("should allow seller to revoke their listing", async function () {
      const uri = "ipfs://QmRevoke";
      const timestamp = Math.floor(Date.now() / 1000);

      const digest = await createDigest(seller.address, uri, timestamp);
      const signature = sellerWallet.signingKey.sign(digest).serialized;

      await registry.submitListingWithSig(seller.address, uri, timestamp, signature);

      await registry.connect(seller).revokeListing(0);

      const listing = await registry.listings(0);
      expect(listing.active).to.be.false;
    });

    it("should reject revoke from non-seller", async function () {
      const uri = "ipfs://QmNotSeller";
      const timestamp = Math.floor(Date.now() / 1000);

      const digest = await createDigest(seller.address, uri, timestamp);
      const signature = sellerWallet.signingKey.sign(digest).serialized;

      await registry.submitListingWithSig(seller.address, uri, timestamp, signature);

      await expect(
        registry.connect(other).revokeListing(0)
      ).to.be.revertedWith("Not your listing");
    });

    it("should reject revoke of already inactive listing", async function () {
      const uri = "ipfs://QmAlreadyInactive";
      const timestamp = Math.floor(Date.now() / 1000);

      const digest = await createDigest(seller.address, uri, timestamp);
      const signature = sellerWallet.signingKey.sign(digest).serialized;

      await registry.submitListingWithSig(seller.address, uri, timestamp, signature);

      await registry.connect(seller).revokeListing(0);

      await expect(
        registry.connect(seller).revokeListing(0)
      ).to.be.revertedWith("Already inactive");
    });
  });

  describe("Force Revoke (Admin)", function () {
    it("should allow owner to force revoke", async function () {
      const uri = "ipfs://QmForceRevokeAdmin";
      const timestamp = Math.floor(Date.now() / 1000);

      const digest = await createDigest(seller.address, uri, timestamp);
      const signature = sellerWallet.signingKey.sign(digest).serialized;

      await registry.submitListingWithSig(seller.address, uri, timestamp, signature);

      await registry.connect(owner).forceRevoke(0);

      const listing = await registry.listings(0);
      expect(listing.active).to.be.false;
    });

    it("should reject force revoke from non-owner", async function () {
      const uri = "ipfs://QmNotOwner";
      const timestamp = Math.floor(Date.now() / 1000);

      const digest = await createDigest(seller.address, uri, timestamp);
      const signature = sellerWallet.signingKey.sign(digest).serialized;

      await registry.submitListingWithSig(seller.address, uri, timestamp, signature);

      await expect(
        registry.connect(other).forceRevoke(0)
      ).to.be.reverted;
    });
  });

  // Helper functions
  async function createDigest(seller, uri, timestamp) {
    const domainSeparator = await registry.DOMAIN_SEPARATOR();
    const structHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "bytes32", "uint256"],
        [TYPEHASH, seller, ethers.keccak256(ethers.toUtf8Bytes(uri)), timestamp]
      )
    );

    return ethers.keccak256(
      ethers.solidityPacked(
        ["bytes1", "bytes1", "bytes32", "bytes32"],
        ["0x19", "0x01", domainSeparator, structHash]
      )
    );
  }

  async function getBlockTimestamp() {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp;
  }
});
