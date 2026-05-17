const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ListingRegistry", function () {
  let registry;
  let owner, seller, buyer;

  const TEST_URI = "ipfs://QmTest123";
  const TEST_TIMESTAMP = Math.floor(Date.now() / 1000);

  beforeEach(async function () {
    [owner, seller, buyer] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("ListingRegistry");
    registry = await Factory.deploy();
    await registry.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await registry.owner()).to.equal(owner.address);
    });

    it("Should have zero listings initially", async function () {
      expect(await registry.listingCount()).to.equal(0);
    });
  });

  describe("submitListingWithSig (EIP-712)", function () {
    it("Should verify and register a valid signed listing", async function () {
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const contractAddress = await registry.getAddress();

      const domain = {
        name: "Nobay Listing",
        chainId: chainId,
        verifyingContract: contractAddress
      };

      const types = {
        Listing: [
          { name: "seller", type: "address" },
          { name: "uri", type: "string" },
          { name: "timestamp", type: "uint256" }
        ]
      };

      const value = {
        seller: seller.address,
        uri: TEST_URI,
        timestamp: TEST_TIMESTAMP
      };

      // Sign the typed data
      const signature = await seller.signTypedData(domain, types, value);

      const tx = await registry.submitListingWithSig(
        seller.address,
        TEST_URI,
        TEST_TIMESTAMP,
        signature
      );

      await expect(tx)
        .to.emit(registry, "ListingVerified")
        .withArgs(0, seller.address, TEST_URI, TEST_TIMESTAMP);

      const listing = await registry.listings(0);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.uri).to.equal(TEST_URI);
      expect(listing.active).to.be.true;
      expect(await registry.listingCount()).to.equal(1);
    });

    it("Should reject invalid signatures", async function () {
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const contractAddress = await registry.getAddress();

      const domain = {
        name: "Nobay Listing",
        chainId: chainId,
        verifyingContract: contractAddress
      };

      const types = { Listing: [{ name: "seller", type: "address" }, { name: "uri", type: "string" }, { name: "timestamp", type: "uint256" }] };
      const value = { seller: seller.address, uri: TEST_URI, timestamp: TEST_TIMESTAMP };

      // Sign with WRONG signer (buyer)
      const invalidSignature = await buyer.signTypedData(domain, types, value);

      await expect(
        registry.submitListingWithSig(
          seller.address,
          TEST_URI,
          TEST_TIMESTAMP,
          invalidSignature
        )
      ).to.be.revertedWith("Invalid signature");
    });
  });

  describe("Revocation", function () {
    let signature;

    beforeEach(async function () {
       const chainId = (await ethers.provider.getNetwork()).chainId;
       const contractAddress = await registry.getAddress();
       const domain = { name: "Nobay Listing", chainId: chainId, verifyingContract: contractAddress };
       const types = { Listing: [{ name: "seller", type: "address" }, { name: "uri", type: "string" }, { name: "timestamp", type: "uint256" }] };
       const value = { seller: seller.address, uri: TEST_URI, timestamp: TEST_TIMESTAMP };
       signature = await seller.signTypedData(domain, types, value);
       await registry.submitListingWithSig(seller.address, TEST_URI, TEST_TIMESTAMP, signature);
    });

    it("Should allow seller to revoke their listing", async function () {
      await expect(registry.connect(seller).revokeListing(0))
        .to.emit(registry, "ListingRevoked");
      
      const listing = await registry.listings(0);
      expect(listing.active).to.be.false;
    });

    it("Should prevent others from revoking a listing", async function () {
      await expect(registry.connect(buyer).revokeListing(0))
        .to.be.revertedWith("Not your listing");
    });

    it("Should allow admin to force revoke", async function () {
      await expect(registry.connect(owner).forceRevoke(0))
        .to.emit(registry, "ListingRevoked");
    });
  });
});
