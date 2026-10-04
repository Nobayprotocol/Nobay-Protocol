const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ListingRegistry", function () {
  let listingRegistry;
  let owner;
  let seller;
  let other;
  let domainSeparator;
  let TYPEHASH;

  const SIGNING_DOMAIN_NAME = "Nobay Listing";
  const SIGNING_DOMAIN_VERSION = "1";

  beforeEach(async function () {
    [owner, seller, other] = await ethers.getSigners();

    const ListingRegistry = await ethers.getContractFactory("ListingRegistry");
    listingRegistry = await ListingRegistry.deploy();
    await listingRegistry.waitForDeployment();

    domainSeparator = await listingRegistry.DOMAIN_SEPARATOR();
    TYPEHASH = await listingRegistry.TYPEHASH();
  });

  async function signListing(signer, sellerAddress, uri, timestamp) {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    
    const domain = {
      name: SIGNING_DOMAIN_NAME,
      chainId: chainId,
      verifyingContract: await listingRegistry.getAddress()
    };

    const types = {
      Listing: [
        { name: "seller", type: "address" },
        { name: "uri", type: "string" },
        { name: "timestamp", type: "uint256" }
      ]
    };

    const value = {
      seller: sellerAddress,
      uri: uri,
      timestamp: timestamp
    };

    return await signer.signTypedData(domain, types, value);
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await listingRegistry.owner()).to.equal(owner.address);
    });

    it("Should initialize with zero listings", async function () {
      expect(await listingRegistry.listingCount()).to.equal(0);
    });

    it("Should set a valid DOMAIN_SEPARATOR", async function () {
      expect(domainSeparator).to.not.equal(ethers.ZeroHash);
    });
  });

  describe("submitListingWithSig", function () {
    it("Should verify valid signature and store listing correctly", async function () {
      const uri = "ipfs://QmTest123";
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await signListing(seller, seller.address, uri, timestamp);

      await expect(listingRegistry.submitListingWithSig(seller.address, uri, timestamp, signature))
        .to.emit(listingRegistry, "ListingVerified")
        .withArgs(0, seller.address, uri, timestamp);

      expect(await listingRegistry.listingCount()).to.equal(1);

      const listing = await listingRegistry.listings(0);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.uri).to.equal(uri);
      expect(listing.timestamp).to.equal(timestamp);
      expect(listing.active).to.be.true;
    });

    it("Should reject invalid signatures (wrong signer)", async function () {
      const uri = "ipfs://QmTest123";
      const timestamp = Math.floor(Date.now() / 1000);
      // Signed by 'other' instead of 'seller'
      const signature = await signListing(other, seller.address, uri, timestamp);

      await expect(
        listingRegistry.submitListingWithSig(seller.address, uri, timestamp, signature)
      ).to.be.revertedWith("Invalid signature");
    });

    it("Should reject invalid signatures (tampered URI)", async function () {
      const uri = "ipfs://QmTest123";
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await signListing(seller, seller.address, uri, timestamp);

      await expect(
        listingRegistry.submitListingWithSig(seller.address, "ipfs://QmTampered", timestamp, signature)
      ).to.be.revertedWith("Invalid signature");
    });

    it("Should reject invalid signatures (tampered timestamp)", async function () {
      const uri = "ipfs://QmTest123";
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await signListing(seller, seller.address, uri, timestamp);

      await expect(
        listingRegistry.submitListingWithSig(seller.address, uri, timestamp + 1, signature)
      ).to.be.revertedWith("Invalid signature");
    });
  });

  describe("revokeListing & forceRevoke", function () {
    let uri;
    let timestamp;
    let signature;

    beforeEach(async function () {
      uri = "ipfs://QmTest123";
      timestamp = Math.floor(Date.now() / 1000);
      signature = await signListing(seller, seller.address, uri, timestamp);
      await listingRegistry.submitListingWithSig(seller.address, uri, timestamp, signature);
    });

    it("Should allow seller to revoke their listing", async function () {
      await expect(listingRegistry.connect(seller).revokeListing(0))
        .to.emit(listingRegistry, "ListingRevoked")
        .withArgs(0, seller.address, await ethers.provider.getBlock("latest").then(b => b.timestamp + 1));

      const listing = await listingRegistry.listings(0);
      expect(listing.active).to.be.false;
    });

    it("Should prevent non-seller from revoking listing", async function () {
      await expect(
        listingRegistry.connect(other).revokeListing(0)
      ).to.be.revertedWith("Not your listing");
    });

    it("Should prevent revoking an already inactive listing", async function () {
      await listingRegistry.connect(seller).revokeListing(0);
      await expect(
        listingRegistry.connect(seller).revokeListing(0)
      ).to.be.revertedWith("Already inactive");
    });

    it("Should allow owner to force revoke listing", async function () {
      await expect(listingRegistry.connect(owner).forceRevoke(0))
        .to.emit(listingRegistry, "ListingRevoked");

      const listing = await listingRegistry.listings(0);
      expect(listing.active).to.be.false;
    });

    it("Should prevent non-owner from force revoking", async function () {
      await expect(
        listingRegistry.connect(other).forceRevoke(0)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});
