const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ListingRegistry", function () {
  let listingRegistry;
  let owner;
  let seller;
  let otherAccount;
  
  const TYPEHASH = ethers.keccak256(
    ethers.toUtf8Bytes("Listing(address seller,string uri,uint256 timestamp)")
  );

  async function getDomainSeparator(chainId, contractAddress) {
    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "bytes32", "uint256", "address"],
        [
          ethers.keccak256(ethers.toUtf8Bytes("EIP712Domain(string name,uint256 chainId,address verifyingContract)")),
          ethers.keccak256(ethers.toUtf8Bytes("Nobay Listing")),
          chainId,
          contractAddress
        ]
      )
    );
  }

  async function getSignature(sellerSigner, uri, timestamp, contractAddress, chainId) {
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
      seller: sellerSigner.address,
      uri: uri,
      timestamp: timestamp
    };

    return await sellerSigner.signTypedData(domain, types, value);
  }

  beforeEach(async function () {
    [owner, seller, otherAccount] = await ethers.getSigners();
    const ListingRegistry = await ethers.getContractFactory("ListingRegistry");
    listingRegistry = await ListingRegistry.deploy();
  });

  describe("Submitting Listings", function () {
    it("Should verify valid signature and emit event", async function () {
      const uri = "ipfs://QmTest";
      const timestamp = Math.floor(Date.now() / 1000);
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const signature = await getSignature(seller, uri, timestamp, await listingRegistry.getAddress(), chainId);

      await expect(listingRegistry.connect(otherAccount).submitListingWithSig(seller.address, uri, timestamp, signature))
        .to.emit(listingRegistry, "ListingVerified")
        .withArgs(0, seller.address, uri, timestamp);

      const listing = await listingRegistry.listings(0);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.uri).to.equal(uri);
      expect(listing.timestamp).to.equal(timestamp);
      expect(listing.active).to.be.true;
    });

    it("Should reject invalid signature", async function () {
      const uri = "ipfs://QmTest";
      const timestamp = Math.floor(Date.now() / 1000);
      const chainId = (await ethers.provider.getNetwork()).chainId;
      
      // Sign with otherAccount instead of seller
      const signature = await getSignature(otherAccount, uri, timestamp, await listingRegistry.getAddress(), chainId);

      await expect(
        listingRegistry.submitListingWithSig(seller.address, uri, timestamp, signature)
      ).to.be.revertedWith("Invalid signature");
    });
  });

  describe("Revoking Listings", function () {
    let listingId = 0;
    
    beforeEach(async function () {
      const uri = "ipfs://QmTest";
      const timestamp = Math.floor(Date.now() / 1000);
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const signature = await getSignature(seller, uri, timestamp, await listingRegistry.getAddress(), chainId);
      await listingRegistry.submitListingWithSig(seller.address, uri, timestamp, signature);
    });

    it("Should allow seller to revoke their active listing", async function () {
      await expect(listingRegistry.connect(seller).revokeListing(listingId))
        .to.emit(listingRegistry, "ListingRevoked");
      
      const listing = await listingRegistry.listings(listingId);
      expect(listing.active).to.be.false;
    });

    it("Should prevent non-seller from revoking", async function () {
      await expect(
        listingRegistry.connect(otherAccount).revokeListing(listingId)
      ).to.be.revertedWith("Not your listing");
    });

    it("Should allow admin to force revoke", async function () {
      await expect(listingRegistry.connect(owner).forceRevoke(listingId))
        .to.emit(listingRegistry, "ListingRevoked");
      
      const listing = await listingRegistry.listings(listingId);
      expect(listing.active).to.be.false;
    });
  });
});
