import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;

describe("ListingRegistry", function () {
  let registry;
  let owner, seller, other, attacker;

  const TYPEHASH = ethers.keccak256(
    ethers.toUtf8Bytes("Listing(address seller,string uri,uint256 timestamp)")
  );

  async function signListing(signer, registryAddr, sellerAddr, uri, timestamp) {
    const domain = {
      name: "Nobay Listing",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: registryAddr,
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

  beforeEach(async function () {
    [owner, seller, other, attacker] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("ListingRegistry");
    registry = await Registry.deploy();
    await registry.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should set deployer as owner", async function () {
      expect(await registry.owner()).to.equal(owner.address);
    });

    it("should initialize listingCount to 0", async function () {
      expect(await registry.listingCount()).to.equal(0);
    });

    it("should set DOMAIN_SEPARATOR correctly", async function () {
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const expectedDomain = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["bytes32", "bytes32", "uint256", "address"],
          [
            ethers.keccak256(
              ethers.toUtf8Bytes("EIP712Domain(string name,uint256 chainId,address verifyingContract)")
            ),
            ethers.keccak256(ethers.toUtf8Bytes("Nobay Listing")),
            chainId,
            await registry.getAddress(),
          ]
        )
      );
      expect(await registry.DOMAIN_SEPARATOR()).to.equal(expectedDomain);
    });

    it("should have correct TYPEHASH", async function () {
      expect(await registry.TYPEHASH()).to.equal(TYPEHASH);
    });
  });

  describe("Signature Validity", function () {
    const uri = "ipfs://QmTest123";
    let timestamp;

    beforeEach(function () {
      timestamp = Math.floor(Date.now() / 1000);
    });

    it("should accept a valid EIP-712 signature from seller", async function () {
      const sig = await signListing(seller, await registry.getAddress(), seller.address, uri, timestamp);
      await registry.connect(other).submitListingWithSig(seller.address, uri, timestamp, sig);

      const listing = await registry.listings(0);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.uri).to.equal(uri);
      expect(listing.timestamp).to.equal(timestamp);
      expect(listing.active).to.be.true;
      expect(await registry.listingCount()).to.equal(1);
    });

    it("should allow anyone to submit a valid signed listing (not just seller)", async function () {
      const sig = await signListing(seller, await registry.getAddress(), seller.address, uri, timestamp);
      await registry.connect(other).submitListingWithSig(seller.address, uri, timestamp, sig);

      const listing = await registry.listings(0);
      expect(listing.seller).to.equal(seller.address);
    });

    it("should emit ListingVerified event with correct args", async function () {
      const sig = await signListing(seller, await registry.getAddress(), seller.address, uri, timestamp);
      await expect(registry.connect(seller).submitListingWithSig(seller.address, uri, timestamp, sig))
        .to.emit(registry, "ListingVerified")
        .withArgs(0, seller.address, uri, timestamp);
    });

    it("should increment listingCount after successful submission", async function () {
      const sig = await signListing(seller, await registry.getAddress(), seller.address, uri, timestamp);
      await registry.connect(seller).submitListingWithSig(seller.address, uri, timestamp, sig);
      expect(await registry.listingCount()).to.equal(1);

      const sig2 = await signListing(seller, await registry.getAddress(), seller.address, "ipfs://Qm456", timestamp + 1);
      await registry.connect(seller).submitListingWithSig(seller.address, "ipfs://Qm456", timestamp + 1, sig2);
      expect(await registry.listingCount()).to.equal(2);
    });

    it("should store correct seller mapping", async function () {
      const sig = await signListing(seller, await registry.getAddress(), seller.address, uri, timestamp);
      await registry.connect(seller).submitListingWithSig(seller.address, uri, timestamp, sig);

      const listing = await registry.listings(0);
      expect(listing.seller).to.equal(seller.address);
    });

    it("should store correct metadata (uri and timestamp)", async function () {
      const testUri = "arweave://abc123def456";
      const testTs = 1700000000;
      const sig = await signListing(seller, await registry.getAddress(), seller.address, testUri, testTs);
      await registry.connect(seller).submitListingWithSig(seller.address, testUri, testTs, sig);

      const listing = await registry.listings(0);
      expect(listing.uri).to.equal(testUri);
      expect(listing.timestamp).to.equal(testTs);
    });

    it("should handle empty URI string", async function () {
      const sig = await signListing(seller, await registry.getAddress(), seller.address, "", timestamp);
      await registry.connect(seller).submitListingWithSig(seller.address, "", timestamp, sig);

      const listing = await registry.listings(0);
      expect(listing.uri).to.equal("");
    });

    it("should handle long URI string", async function () {
      const longUri = "ipfs://" + "x".repeat(200);
      const sig = await signListing(seller, await registry.getAddress(), seller.address, longUri, timestamp);
      await registry.connect(seller).submitListingWithSig(seller.address, longUri, timestamp, sig);

      const listing = await registry.listings(0);
      expect(listing.uri).to.equal(longUri);
    });
  });

  describe("Rejection of Invalid Signatures", function () {
    const uri = "ipfs://QmTest123";
    let timestamp;

    beforeEach(function () {
      timestamp = Math.floor(Date.now() / 1000);
    });

    it("should reject signature from wrong signer (attacker signs as seller)", async function () {
      const sig = await signListing(attacker, await registry.getAddress(), seller.address, uri, timestamp);
      await expect(
        registry.connect(other).submitListingWithSig(seller.address, uri, timestamp, sig)
      ).to.be.revertedWith("Invalid signature");
    });

    it("should reject signature with wrong URI", async function () {
      const sig = await signListing(seller, await registry.getAddress(), seller.address, "ipfs://ORIGINAL", timestamp);
      await expect(
        registry.connect(other).submitListingWithSig(seller.address, "ipfs://TAMPERED", timestamp, sig)
      ).to.be.revertedWith("Invalid signature");
    });

    it("should reject signature with wrong timestamp", async function () {
      const sig = await signListing(seller, await registry.getAddress(), seller.address, uri, timestamp);
      await expect(
        registry.connect(other).submitListingWithSig(seller.address, uri, timestamp + 1, sig)
      ).to.be.revertedWith("Invalid signature");
    });

    it("should reject signature with wrong seller address", async function () {
      const sig = await signListing(seller, await registry.getAddress(), seller.address, uri, timestamp);
      await expect(
        registry.connect(other).submitListingWithSig(other.address, uri, timestamp, sig)
      ).to.be.revertedWith("Invalid signature");
    });

    it("should reject signature for wrong contract address", async function () {
      const fakeContractAddr = attacker.address;
      const sig = await signListing(seller, fakeContractAddr, seller.address, uri, timestamp);
      await expect(
        registry.connect(other).submitListingWithSig(seller.address, uri, timestamp, sig)
      ).to.be.revertedWith("Invalid signature");
    });

    it("should reject signature for wrong chainId", async function () {
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const domain = {
        name: "Nobay Listing",
        chainId: chainId + 1n,
        verifyingContract: await registry.getAddress(),
      };
      const types = {
        Listing: [
          { name: "seller", type: "address" },
          { name: "uri", type: "string" },
          { name: "timestamp", type: "uint256" },
        ],
      };
      const sig = await seller.signTypedData(domain, types, { seller: seller.address, uri, timestamp });
      await expect(
        registry.connect(other).submitListingWithSig(seller.address, uri, timestamp, sig)
      ).to.be.revertedWith("Invalid signature");
    });

    it("should reject empty/zero-length signature", async function () {
      await expect(
        registry.connect(other).submitListingWithSig(seller.address, uri, timestamp, "0x")
      ).to.be.reverted;
    });

    it("should reject garbage signature bytes", async function () {
      const garbageSig = "0x" + "ab".repeat(65);
      await expect(
        registry.connect(other).submitListingWithSig(seller.address, uri, timestamp, garbageSig)
      ).to.be.reverted;
    });

    it("should allow replay of same signature (no replay protection — documented behavior)", async function () {
      const sig = await signListing(seller, await registry.getAddress(), seller.address, uri, timestamp);
      await registry.connect(other).submitListingWithSig(seller.address, uri, timestamp, sig);
      // Replay — same signature creates duplicate listing (no nonce/replay protection)
      await registry.connect(other).submitListingWithSig(seller.address, uri, timestamp, sig);
      expect(await registry.listingCount()).to.equal(2);
    });
  });

  describe("Event Emission", function () {
    let timestamp;

    beforeEach(function () {
      timestamp = Math.floor(Date.now() / 1000);
    });

    it("should emit ListingVerified on successful submission", async function () {
      const uri = "ipfs://QmEventTest";
      const sig = await signListing(seller, await registry.getAddress(), seller.address, uri, timestamp);
      await expect(registry.connect(seller).submitListingWithSig(seller.address, uri, timestamp, sig))
        .to.emit(registry, "ListingVerified");
    });

    it("should emit ListingRevoked on revoke", async function () {
      const uri = "ipfs://QmRevokeEvent";
      const sig = await signListing(seller, await registry.getAddress(), seller.address, uri, timestamp);
      await registry.connect(seller).submitListingWithSig(seller.address, uri, timestamp, sig);

      const tx = await registry.connect(seller).revokeListing(0);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(registry, "ListingRevoked")
        .withArgs(0, seller.address, block.timestamp);
    });

    it("should emit ListingRevoked on forceRevoke", async function () {
      const uri = "ipfs://QmForceEvent";
      const sig = await signListing(seller, await registry.getAddress(), seller.address, uri, timestamp);
      await registry.connect(seller).submitListingWithSig(seller.address, uri, timestamp, sig);

      await expect(registry.connect(owner).forceRevoke(0))
        .to.emit(registry, "ListingRevoked");
    });

    it("should emit events with correct indexed parameters", async function () {
      const uri = "ipfs://QmIndexed";
      const sig = await signListing(seller, await registry.getAddress(), seller.address, uri, timestamp);
      const tx = await registry.connect(seller).submitListingWithSig(seller.address, uri, timestamp, sig);
      const receipt = await tx.wait();

      const event = receipt.logs.find(
        (log) => { try { return registry.interface.parseLog(log)?.name === "ListingVerified"; } catch { return false; } }
      );
      const parsed = registry.interface.parseLog(event);
      expect(parsed.args.listingId).to.equal(0n);
      expect(parsed.args.seller).to.equal(seller.address);
      expect(parsed.args.uri).to.equal(uri);
    });
  });

  describe("Seller Mapping and Metadata Accuracy", function () {
    it("should correctly map multiple listings from same seller", async function () {
      const ts = Math.floor(Date.now() / 1000);
      for (let i = 0; i < 3; i++) {
        const uri = `ipfs://QmListing${i}`;
        const sig = await signListing(seller, await registry.getAddress(), seller.address, uri, ts + i);
        await registry.connect(seller).submitListingWithSig(seller.address, uri, ts + i, sig);
      }

      for (let i = 0; i < 3; i++) {
        const listing = await registry.listings(i);
        expect(listing.seller).to.equal(seller.address);
        expect(listing.uri).to.equal(`ipfs://QmListing${i}`);
        expect(listing.timestamp).to.equal(ts + i);
        expect(listing.active).to.be.true;
      }
    });

    it("should correctly map listings from different sellers", async function () {
      const ts = Math.floor(Date.now() / 1000);

      const sig1 = await signListing(seller, await registry.getAddress(), seller.address, "ipfs://seller1", ts);
      await registry.connect(seller).submitListingWithSig(seller.address, "ipfs://seller1", ts, sig1);

      const sig2 = await signListing(other, await registry.getAddress(), other.address, "ipfs://other1", ts + 1);
      await registry.connect(other).submitListingWithSig(other.address, "ipfs://other1", ts + 1, sig2);

      const listing0 = await registry.listings(0);
      expect(listing0.seller).to.equal(seller.address);

      const listing1 = await registry.listings(1);
      expect(listing1.seller).to.equal(other.address);
    });

    it("should maintain accurate listingCount across operations", async function () {
      const ts = Math.floor(Date.now() / 1000);

      for (let i = 0; i < 3; i++) {
        const uri = `ipfs://Qm${i}`;
        const sig = await signListing(seller, await registry.getAddress(), seller.address, uri, ts + i);
        await registry.connect(seller).submitListingWithSig(seller.address, uri, ts + i, sig);
      }
      expect(await registry.listingCount()).to.equal(3);

      await registry.connect(seller).revokeListing(1);
      expect(await registry.listingCount()).to.equal(3);
    });

    it("should preserve metadata after revocation", async function () {
      const ts = Math.floor(Date.now() / 1000);
      const uri = "ipfs://QmRevokeTest";
      const sig = await signListing(seller, await registry.getAddress(), seller.address, uri, ts);
      await registry.connect(seller).submitListingWithSig(seller.address, uri, ts, sig);

      await registry.connect(seller).revokeListing(0);

      const listing = await registry.listings(0);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.uri).to.equal(uri);
      expect(listing.timestamp).to.equal(ts);
      expect(listing.active).to.be.false;
    });
  });

  describe("Revoke Listing", function () {
    const uri = "ipfs://QmRevoke";
    let timestamp;

    beforeEach(async function () {
      timestamp = Math.floor(Date.now() / 1000);
      const sig = await signListing(seller, await registry.getAddress(), seller.address, uri, timestamp);
      await registry.connect(seller).submitListingWithSig(seller.address, uri, timestamp, sig);
    });

    it("should allow seller to revoke their own listing", async function () {
      await registry.connect(seller).revokeListing(0);
      const listing = await registry.listings(0);
      expect(listing.active).to.be.false;
    });

    it("should revert if non-seller tries to revoke", async function () {
      await expect(
        registry.connect(attacker).revokeListing(0)
      ).to.be.revertedWith("Not your listing");
    });

    it("should revert if listing is already inactive", async function () {
      await registry.connect(seller).revokeListing(0);
      await expect(
        registry.connect(seller).revokeListing(0)
      ).to.be.revertedWith("Already inactive");
    });

    it("should emit ListingRevoked with correct block.timestamp", async function () {
      const tx = await registry.connect(seller).revokeListing(0);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      await expect(tx)
        .to.emit(registry, "ListingRevoked")
        .withArgs(0, seller.address, block.timestamp);
    });
  });

  describe("Force Revoke (Owner)", function () {
    const uri = "ipfs://QmForce";
    let timestamp;

    beforeEach(async function () {
      timestamp = Math.floor(Date.now() / 1000);
      const sig = await signListing(seller, await registry.getAddress(), seller.address, uri, timestamp);
      await registry.connect(seller).submitListingWithSig(seller.address, uri, timestamp, sig);
    });

    it("should allow owner to force revoke any listing", async function () {
      await registry.connect(owner).forceRevoke(0);
      const listing = await registry.listings(0);
      expect(listing.active).to.be.false;
    });

    it("should revert if non-owner tries to force revoke", async function () {
      await expect(
        registry.connect(attacker).forceRevoke(0)
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });

    it("should emit ListingRevoked with seller's address (not owner)", async function () {
      const tx = await registry.connect(owner).forceRevoke(0);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      await expect(tx)
        .to.emit(registry, "ListingRevoked")
        .withArgs(0, seller.address, block.timestamp);
    });

    it("should work even if listing is already inactive", async function () {
      await registry.connect(owner).forceRevoke(0);
      // forceRevoke doesn't check active status, so it shouldn't revert
      await registry.connect(owner).forceRevoke(0);
    });
  });

  describe("Edge Cases", function () {
    it("should handle sequential listings with incrementing IDs", async function () {
      const ts = Math.floor(Date.now() / 1000);
      for (let i = 0; i < 5; i++) {
        const uri = `ipfs://Qm${i}`;
        const sig = await signListing(seller, await registry.getAddress(), seller.address, uri, ts + i);
        const tx = await registry.connect(seller).submitListingWithSig(seller.address, uri, ts + i, sig);
        const receipt = await tx.wait();
        const event = receipt.logs.find(
          (log) => { try { return registry.interface.parseLog(log)?.name === "ListingVerified"; } catch { return false; } }
        );
        const parsed = registry.interface.parseLog(event);
        expect(parsed.args.listingId).to.equal(BigInt(i));
      }
      expect(await registry.listingCount()).to.equal(5);
    });

    it("should handle timestamp = 0", async function () {
      const sig = await signListing(seller, await registry.getAddress(), seller.address, "ipfs://zero", 0);
      await registry.connect(seller).submitListingWithSig(seller.address, "ipfs://zero", 0, sig);
      const listing = await registry.listings(0);
      expect(listing.timestamp).to.equal(0);
    });

    it("listing with non-existent ID returns zero-initialized struct", async function () {
      const listing = await registry.listings(999);
      expect(listing.seller).to.equal(ethers.ZeroAddress);
      expect(listing.uri).to.equal("");
      expect(listing.timestamp).to.equal(0);
      expect(listing.active).to.be.false;
    });
  });
});
