const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ListingRegistry", function () {
  let listingRegistry;
  let owner, seller, other;
  let domain;

  const types = {
    Listing: [
      { name: "seller", type: "address" },
      { name: "uri", type: "string" },
      { name: "timestamp", type: "uint256" },
    ],
  };

  beforeEach(async function () {
    [owner, seller, other] = await ethers.getSigners();

    const ListingRegistry = await ethers.getContractFactory("ListingRegistry");
    listingRegistry = await ListingRegistry.deploy();
    await listingRegistry.waitForDeployment();

    const chainId = (await ethers.provider.getNetwork()).chainId;
    domain = {
      name: "Nobay Listing",
      chainId: chainId,
      verifyingContract: await listingRegistry.getAddress(),
    };
  });

  describe("Signature Validity", function () {
    it("should accept a valid EIP-712 signature", async function () {
      const uri = "ipfs://QmTest123";
      const timestamp = Math.floor(Date.now() / 1000);

      const value = { seller: seller.address, uri, timestamp };
      const signature = await seller.signTypedData(domain, types, value);

      await expect(
        listingRegistry.submitListingWithSig(seller.address, uri, timestamp, signature)
      ).to.emit(listingRegistry, "ListingVerified");

      const listing = await listingRegistry.listings(0);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.uri).to.equal(uri);
      expect(listing.active).to.be.true;
    });
  });

  describe("Rejection of Invalid Signatures", function () {
    it("should reject signature from wrong signer", async function () {
      const uri = "ipfs://QmTest456";
      const timestamp = Math.floor(Date.now() / 1000);

      const value = { seller: seller.address, uri, timestamp };
      // Sign with 'other' instead of 'seller'
      const signature = await other.signTypedData(domain, types, value);

      await expect(
        listingRegistry.submitListingWithSig(seller.address, uri, timestamp, signature)
      ).to.be.revertedWith("Invalid signature");
    });

    it("should reject signature with wrong URI", async function () {
      const uri = "ipfs://QmCorrect";
      const wrongUri = "ipfs://QmWrong";
      const timestamp = Math.floor(Date.now() / 1000);

      const value = { seller: seller.address, uri, timestamp };
      const signature = await seller.signTypedData(domain, types, value);

      await expect(
        listingRegistry.submitListingWithSig(seller.address, wrongUri, timestamp, signature)
      ).to.be.revertedWith("Invalid signature");
    });

    it("should reject signature with wrong timestamp", async function () {
      const uri = "ipfs://QmTest789";
      const timestamp = Math.floor(Date.now() / 1000);
      const wrongTimestamp = timestamp + 1000;

      const value = { seller: seller.address, uri, timestamp };
      const signature = await seller.signTypedData(domain, types, value);

      await expect(
        listingRegistry.submitListingWithSig(seller.address, uri, wrongTimestamp, signature)
      ).to.be.revertedWith("Invalid signature");
    });
  });

  describe("Event Emission", function () {
    it("should emit ListingVerified event with correct parameters", async function () {
      const uri = "ipfs://QmEventTest";
      const timestamp = Math.floor(Date.now() / 1000);

      const value = { seller: seller.address, uri, timestamp };
      const signature = await seller.signTypedData(domain, types, value);

      await expect(
        listingRegistry.submitListingWithSig(seller.address, uri, timestamp, signature)
      )
        .to.emit(listingRegistry, "ListingVerified")
        .withArgs(0, seller.address, uri, timestamp);
    });

    it("should emit ListingRevoked event when seller revokes", async function () {
      const uri = "ipfs://QmRevokeTest";
      const timestamp = Math.floor(Date.now() / 1000);

      await submitListing(seller, uri, timestamp);

      await expect(listingRegistry.connect(seller).revokeListing(0))
        .to.emit(listingRegistry, "ListingRevoked");
    });
  });

  describe("Seller Mapping and Metadata Accuracy", function () {
    it("should store correct seller address", async function () {
      const uri = "ipfs://QmSellerTest";
      const timestamp = Math.floor(Date.now() / 1000);

      await submitListing(seller, uri, timestamp);
      const listing = await listingRegistry.listings(0);
      expect(listing.seller).to.equal(seller.address);
    });

    it("should store correct URI", async function () {
      const uri = "ipfs://QmUriTest";
      const timestamp = Math.floor(Date.now() / 1000);

      await submitListing(seller, uri, timestamp);
      const listing = await listingRegistry.listings(0);
      expect(listing.uri).to.equal(uri);
    });

    it("should store correct timestamp", async function () {
      const uri = "ipfs://QmTimestampTest";
      const timestamp = Math.floor(Date.now() / 1000);

      await submitListing(seller, uri, timestamp);
      const listing = await listingRegistry.listings(0);
      expect(listing.timestamp).to.equal(timestamp);
    });

    it("should set listing as active by default", async function () {
      const uri = "ipfs://QmActiveTest";
      const timestamp = Math.floor(Date.now() / 1000);

      await submitListing(seller, uri, timestamp);
      const listing = await listingRegistry.listings(0);
      expect(listing.active).to.be.true;
    });

    it("should increment listing count", async function () {
      const timestamp = Math.floor(Date.now() / 1000);

      await submitListing(seller, "ipfs://QmCount1", timestamp);
      await submitListing(seller, "ipfs://QmCount2", timestamp);

      expect(await listingRegistry.listingCount()).to.equal(2);
    });

    it("should allow seller to revoke their own listing", async function () {
      const uri = "ipfs://QmRevokeOwn";
      const timestamp = Math.floor(Date.now() / 1000);

      await submitListing(seller, uri, timestamp);
      await listingRegistry.connect(seller).revokeListing(0);

      const listing = await listingRegistry.listings(0);
      expect(listing.active).to.be.false;
    });

    it("should prevent non-seller from revoking", async function () {
      const uri = "ipfs://QmRevokeFail";
      const timestamp = Math.floor(Date.now() / 1000);

      await submitListing(seller, uri, timestamp);

      await expect(
        listingRegistry.connect(other).revokeListing(0)
      ).to.be.revertedWith("Not your listing");
    });

    it("should prevent revoking already inactive listing", async function () {
      const uri = "ipfs://QmRevokeTwice";
      const timestamp = Math.floor(Date.now() / 1000);

      await submitListing(seller, uri, timestamp);
      await listingRegistry.connect(seller).revokeListing(0);

      await expect(
        listingRegistry.connect(seller).revokeListing(0)
      ).to.be.revertedWith("Already inactive");
    });

    it("should allow owner to force revoke", async function () {
      const uri = "ipfs://QmForceRevoke";
      const timestamp = Math.floor(Date.now() / 1000);

      await submitListing(seller, uri, timestamp);
      await listingRegistry.connect(owner).forceRevoke(0);

      const listing = await listingRegistry.listings(0);
      expect(listing.active).to.be.false;
    });

    it("should prevent non-owner from force revoking", async function () {
      const uri = "ipfs://QmForceRevokeFail";
      const timestamp = Math.floor(Date.now() / 1000);

      await submitListing(seller, uri, timestamp);

      await expect(
        listingRegistry.connect(other).forceRevoke(0)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  async function submitListing(signer, uri, timestamp) {
    const value = { seller: signer.address, uri, timestamp };
    const signature = await signer.signTypedData(domain, types, value);
    return listingRegistry.submitListingWithSig(signer.address, uri, timestamp, signature);
  }
});
