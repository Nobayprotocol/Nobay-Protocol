const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ListingRegistry", function () {
  let listingRegistry;
  let owner;
  let seller;
  let buyer;

  // EIP-712 domain data (must match contract's constructor)
  const DOMAIN_NAME = "Nobay Listing";
  // Note: contract does NOT include version in EIP712Domain — domain is:
  // EIP712Domain(string name,uint256 chainId,address verifyingContract)

  beforeEach(async function () {
    [owner, seller, buyer] = await ethers.getSigners();

    const ListingRegistry = await ethers.getContractFactory("ListingRegistry");
    listingRegistry = await ListingRegistry.deploy();
    await listingRegistry.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      expect(await listingRegistry.getAddress()).to.not.equal(ethers.ZeroAddress);
    });

    it("Should have correct domain separator", async function () {
      const domainSeparator = await listingRegistry.DOMAIN_SEPARATOR();
      expect(domainSeparator).to.not.equal(ethers.ZeroHash);
    });

    it("Should have correct TYPEHASH", async function () {
      const typeHash = await listingRegistry.TYPEHASH();
      const expectedTypeHash = ethers.keccak256(
        ethers.toUtf8Bytes("Listing(address seller,string uri,uint256 timestamp)")
      );
      expect(typeHash).to.equal(expectedTypeHash);
    });

    it("Should start with zero listings", async function () {
      expect(await listingRegistry.listingCount()).to.equal(0);
    });
  });

  describe("Signature Verification", function () {
    it("Should accept a valid EIP-712 signature", async function () {
      const uri = "ipfs://QmTest123";
      const timestamp = Math.floor(Date.now() / 1000);

      // Create EIP-712 signature
      const domain = {
        name: DOMAIN_NAME,
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await listingRegistry.getAddress(),
      };

      const types = {
        Listing: [
          { name: "seller", type: "address" },
          { name: "uri", type: "string" },
          { name: "timestamp", type: "uint256" },
        ],
      };

      const value = {
        seller: seller.address,
        uri: uri,
        timestamp: timestamp,
      };

      const signature = await seller.signTypedData(domain, types, value);

      // Submit the listing
      const tx = await listingRegistry.submitListingWithSig(
        seller.address,
        uri,
        timestamp,
        signature
      );

      await expect(tx)
        .to.emit(listingRegistry, "ListingVerified")
        .withArgs(0, seller.address, uri, timestamp);
    });

    it("Should reject an invalid signature (wrong signer)", async function () {
      const uri = "ipfs://QmTest123";
      const timestamp = Math.floor(Date.now() / 1000);

      // Sign with buyer instead of seller
      const domain = {
        name: DOMAIN_NAME,
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await listingRegistry.getAddress(),
      };

      const types = {
        Listing: [
          { name: "seller", type: "address" },
          { name: "uri", type: "string" },
          { name: "timestamp", type: "uint256" },
        ],
      };

      const value = {
        seller: seller.address,
        uri: uri,
        timestamp: timestamp,
      };

      // Buyer signs but seller is specified
      const signature = await buyer.signTypedData(domain, types, value);

      await expect(
        listingRegistry.submitListingWithSig(seller.address, uri, timestamp, signature)
      ).to.be.revertedWith("Invalid signature");
    });

    it("Should reject a signature with tampered URI", async function () {
      const uri = "ipfs://QmTest123";
      const timestamp = Math.floor(Date.now() / 1000);

      const domain = {
        name: DOMAIN_NAME,
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await listingRegistry.getAddress(),
      };

      const types = {
        Listing: [
          { name: "seller", type: "address" },
          { name: "uri", type: "string" },
          { name: "timestamp", type: "uint256" },
        ],
      };

      const value = {
        seller: seller.address,
        uri: uri,
        timestamp: timestamp,
      };

      const signature = await seller.signTypedData(domain, types, value);

      // Submit with different URI
      await expect(
        listingRegistry.submitListingWithSig(
          seller.address,
          "ipfs://QmTampered",
          timestamp,
          signature
        )
      ).to.be.revertedWith("Invalid signature");
    });

    it("Should reject a signature with tampered timestamp", async function () {
      const uri = "ipfs://QmTest123";
      const timestamp = Math.floor(Date.now() / 1000);

      const domain = {
        name: DOMAIN_NAME,
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await listingRegistry.getAddress(),
      };

      const types = {
        Listing: [
          { name: "seller", type: "address" },
          { name: "uri", type: "string" },
          { name: "timestamp", type: "uint256" },
        ],
      };

      const value = {
        seller: seller.address,
        uri: uri,
        timestamp: timestamp,
      };

      const signature = await seller.signTypedData(domain, types, value);

      // Submit with different timestamp
      await expect(
        listingRegistry.submitListingWithSig(
          seller.address,
          uri,
          timestamp + 1,
          signature
        )
      ).to.be.revertedWith("Invalid signature");
    });

    it("Should reject a signature for a different seller", async function () {
      const uri = "ipfs://QmTest123";
      const timestamp = Math.floor(Date.now() / 1000);

      const domain = {
        name: DOMAIN_NAME,
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await listingRegistry.getAddress(),
      };

      const types = {
        Listing: [
          { name: "seller", type: "address" },
          { name: "uri", type: "string" },
          { name: "timestamp", type: "uint256" },
        ],
      };

      // Sign for seller
      const value = {
        seller: seller.address,
        uri: uri,
        timestamp: timestamp,
      };

      const signature = await seller.signTypedData(domain, types, value);

      // Submit for buyer (different seller)
      await expect(
        listingRegistry.submitListingWithSig(buyer.address, uri, timestamp, signature)
      ).to.be.revertedWith("Invalid signature");
    });
  });

  describe("Event Emission", function () {
    it("Should emit ListingVerified with correct parameters", async function () {
      const uri = "ipfs://QmTestEvent";
      const timestamp = Math.floor(Date.now() / 1000);

      const domain = {
        name: DOMAIN_NAME,
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await listingRegistry.getAddress(),
      };

      const types = {
        Listing: [
          { name: "seller", type: "address" },
          { name: "uri", type: "string" },
          { name: "timestamp", type: "uint256" },
        ],
      };

      const value = {
        seller: seller.address,
        uri: uri,
        timestamp: timestamp,
      };

      const signature = await seller.signTypedData(domain, types, value);

      await expect(
        listingRegistry.submitListingWithSig(seller.address, uri, timestamp, signature)
      )
        .to.emit(listingRegistry, "ListingVerified")
        .withArgs(0, seller.address, uri, timestamp);
    });

    it("Should emit ListingRevoked when seller revokes", async function () {
      const uri = "ipfs://QmTestRevoke";
      const timestamp = Math.floor(Date.now() / 1000);

      const domain = {
        name: DOMAIN_NAME,
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await listingRegistry.getAddress(),
      };

      const types = {
        Listing: [
          { name: "seller", type: "address" },
          { name: "uri", type: "string" },
          { name: "timestamp", type: "uint256" },
        ],
      };

      const value = {
        seller: seller.address,
        uri: uri,
        timestamp: timestamp,
      };

      const signature = await seller.signTypedData(domain, types, value);
      await listingRegistry.submitListingWithSig(seller.address, uri, timestamp, signature);

      const tx = await listingRegistry.connect(seller).revokeListing(0);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(listingRegistry, "ListingRevoked")
        .withArgs(0, seller.address, block.timestamp);
    });
  });

  describe("Seller Mapping and Metadata Accuracy", function () {
    it("Should store correct seller address", async function () {
      const uri = "ipfs://QmTestSeller";
      const timestamp = Math.floor(Date.now() / 1000);

      const domain = {
        name: DOMAIN_NAME,
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await listingRegistry.getAddress(),
      };

      const types = {
        Listing: [
          { name: "seller", type: "address" },
          { name: "uri", type: "string" },
          { name: "timestamp", type: "uint256" },
        ],
      };

      const value = {
        seller: seller.address,
        uri: uri,
        timestamp: timestamp,
      };

      const signature = await seller.signTypedData(domain, types, value);
      await listingRegistry.submitListingWithSig(seller.address, uri, timestamp, signature);

      const listing = await listingRegistry.listings(0);
      expect(listing.seller).to.equal(seller.address);
    });

    it("Should store correct URI", async function () {
      const uri = "ipfs://QmTestUriAccuracy";
      const timestamp = Math.floor(Date.now() / 1000);

      const domain = {
        name: DOMAIN_NAME,
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await listingRegistry.getAddress(),
      };

      const types = {
        Listing: [
          { name: "seller", type: "address" },
          { name: "uri", type: "string" },
          { name: "timestamp", type: "uint256" },
        ],
      };

      const value = {
        seller: seller.address,
        uri: uri,
        timestamp: timestamp,
      };

      const signature = await seller.signTypedData(domain, types, value);
      await listingRegistry.submitListingWithSig(seller.address, uri, timestamp, signature);

      const listing = await listingRegistry.listings(0);
      expect(listing.uri).to.equal(uri);
    });

    it("Should store correct timestamp", async function () {
      const uri = "ipfs://QmTestTimestamp";
      const timestamp = Math.floor(Date.now() / 1000);

      const domain = {
        name: DOMAIN_NAME,
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await listingRegistry.getAddress(),
      };

      const types = {
        Listing: [
          { name: "seller", type: "address" },
          { name: "uri", type: "string" },
          { name: "timestamp", type: "uint256" },
        ],
      };

      const value = {
        seller: seller.address,
        uri: uri,
        timestamp: timestamp,
      };

      const signature = await seller.signTypedData(domain, types, value);
      await listingRegistry.submitListingWithSig(seller.address, uri, timestamp, signature);

      const listing = await listingRegistry.listings(0);
      expect(listing.timestamp).to.equal(timestamp);
    });

    it("Should mark listing as active", async function () {
      const uri = "ipfs://QmTestActive";
      const timestamp = Math.floor(Date.now() / 1000);

      const domain = {
        name: DOMAIN_NAME,
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await listingRegistry.getAddress(),
      };

      const types = {
        Listing: [
          { name: "seller", type: "address" },
          { name: "uri", type: "string" },
          { name: "timestamp", type: "uint256" },
        ],
      };

      const value = {
        seller: seller.address,
        uri: uri,
        timestamp: timestamp,
      };

      const signature = await seller.signTypedData(domain, types, value);
      await listingRegistry.submitListingWithSig(seller.address, uri, timestamp, signature);

      const listing = await listingRegistry.listings(0);
      expect(listing.active).to.be.true;
    });

    it("Should increment listing count", async function () {
      const uri = "ipfs://QmTestCount";
      const timestamp = Math.floor(Date.now() / 1000);

      const domain = {
        name: DOMAIN_NAME,
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await listingRegistry.getAddress(),
      };

      const types = {
        Listing: [
          { name: "seller", type: "address" },
          { name: "uri", type: "string" },
          { name: "timestamp", type: "uint256" },
        ],
      };

      const value = {
        seller: seller.address,
        uri: uri,
        timestamp: timestamp,
      };

      const signature = await seller.signTypedData(domain, types, value);

      expect(await listingRegistry.listingCount()).to.equal(0);
      await listingRegistry.submitListingWithSig(seller.address, uri, timestamp, signature);
      expect(await listingRegistry.listingCount()).to.equal(1);
      // Second listing needs a fresh signature with new timestamp
      const timestamp2 = timestamp + 1;
      const value2 = { seller: seller.address, uri, timestamp: timestamp2 };
      const signature2 = await seller.signTypedData(domain, types, value2);
      await listingRegistry.submitListingWithSig(seller.address, uri, timestamp2, signature2);
      expect(await listingRegistry.listingCount()).to.equal(2);
    });
  });

  describe("Listing Revocation", function () {
    beforeEach(async function () {
      const uri = "ipfs://QmTestRevoke";
      const timestamp = Math.floor(Date.now() / 1000);

      const domain = {
        name: DOMAIN_NAME,
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await listingRegistry.getAddress(),
      };

      const types = {
        Listing: [
          { name: "seller", type: "address" },
          { name: "uri", type: "string" },
          { name: "timestamp", type: "uint256" },
        ],
      };

      const value = {
        seller: seller.address,
        uri: uri,
        timestamp: timestamp,
      };

      const signature = await seller.signTypedData(domain, types, value);
      await listingRegistry.submitListingWithSig(seller.address, uri, timestamp, signature);
    });

    it("Should allow seller to revoke their own listing", async function () {
      await listingRegistry.connect(seller).revokeListing(0);
      const listing = await listingRegistry.listings(0);
      expect(listing.active).to.be.false;
    });

    it("Should emit ListingRevoked event", async function () {
      await expect(listingRegistry.connect(seller).revokeListing(0))
        .to.emit(listingRegistry, "ListingRevoked");
    });

    it("Should prevent non-seller from revoking", async function () {
      await expect(
        listingRegistry.connect(buyer).revokeListing(0)
      ).to.be.revertedWith("Not your listing");
    });

    it("Should prevent revoking already inactive listing", async function () {
      await listingRegistry.connect(seller).revokeListing(0);
      await expect(
        listingRegistry.connect(seller).revokeListing(0)
      ).to.be.revertedWith("Already inactive");
    });

    it("Should allow admin to force revoke", async function () {
      await listingRegistry.forceRevoke(0);
      const listing = await listingRegistry.listings(0);
      expect(listing.active).to.be.false;
    });

    it("Should emit ListingRevoked on force revoke", async function () {
      await expect(listingRegistry.forceRevoke(0))
        .to.emit(listingRegistry, "ListingRevoked");
    });
  });

  describe("Multiple Listings", function () {
    it("Should handle multiple listings from different sellers", async function () {
      const sellers = [seller, buyer, owner];
      const timestamp = Math.floor(Date.now() / 1000);

      for (let i = 0; i < sellers.length; i++) {
        const uri = `ipfs://QmTest${i}`;
        const domain = {
          name: DOMAIN_NAME,
            chainId: (await ethers.provider.getNetwork()).chainId,
          verifyingContract: await listingRegistry.getAddress(),
        };

        const types = {
          Listing: [
            { name: "seller", type: "address" },
            { name: "uri", type: "string" },
            { name: "timestamp", type: "uint256" },
          ],
        };

        const value = {
          seller: sellers[i].address,
          uri: uri,
          timestamp: timestamp + i,
        };

        const signature = await sellers[i].signTypedData(domain, types, value);
        await listingRegistry.submitListingWithSig(sellers[i].address, uri, timestamp + i, signature);
      }

      expect(await listingRegistry.listingCount()).to.equal(3);

      for (let i = 0; i < 3; i++) {
        const listing = await listingRegistry.listings(i);
        expect(listing.seller).to.equal(sellers[i].address);
        expect(listing.active).to.be.true;
      }
    });

    it("Should return correct listing ID", async function () {
      const uri = "ipfs://QmTestId";
      const timestamp = Math.floor(Date.now() / 1000);

      const domain = {
        name: DOMAIN_NAME,
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await listingRegistry.getAddress(),
      };

      const types = {
        Listing: [
          { name: "seller", type: "address" },
          { name: "uri", type: "string" },
          { name: "timestamp", type: "uint256" },
        ],
      };

      const value = {
        seller: seller.address,
        uri: uri,
        timestamp: timestamp,
      };

      const signature = await seller.signTypedData(domain, types, value);
      const tx = await listingRegistry.submitListingWithSig(seller.address, uri, timestamp, signature);
      const receipt = await tx.wait();

      // Check the return value via event
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "ListingVerified"
      );
      expect(event.args[0]).to.equal(0); // listingId
    });
  });

  describe("Edge Cases", function () {
    it("Should handle empty URI", async function () {
      const uri = "";
      const timestamp = Math.floor(Date.now() / 1000);

      const domain = {
        name: DOMAIN_NAME,
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await listingRegistry.getAddress(),
      };

      const types = {
        Listing: [
          { name: "seller", type: "address" },
          { name: "uri", type: "string" },
          { name: "timestamp", type: "uint256" },
        ],
      };

      const value = {
        seller: seller.address,
        uri: uri,
        timestamp: timestamp,
      };

      const signature = await seller.signTypedData(domain, types, value);
      const tx = await listingRegistry.submitListingWithSig(seller.address, uri, timestamp, signature);

      await expect(tx).to.emit(listingRegistry, "ListingVerified");
    });

    it("Should handle very long URI", async function () {
      const uri = "ipfs://Qm" + "a".repeat(500);
      const timestamp = Math.floor(Date.now() / 1000);

      const domain = {
        name: DOMAIN_NAME,
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await listingRegistry.getAddress(),
      };

      const types = {
        Listing: [
          { name: "seller", type: "address" },
          { name: "uri", type: "string" },
          { name: "timestamp", type: "uint256" },
        ],
      };

      const value = {
        seller: seller.address,
        uri: uri,
        timestamp: timestamp,
      };

      const signature = await seller.signTypedData(domain, types, value);
      const tx = await listingRegistry.submitListingWithSig(seller.address, uri, timestamp, signature);

      await expect(tx).to.emit(listingRegistry, "ListingVerified");

      const listing = await listingRegistry.listings(0);
      expect(listing.uri).to.equal(uri);
    });

    it("Should reject signature reuse with different timestamp", async function () {
      const uri = "ipfs://QmTestReuse";
      const timestamp = Math.floor(Date.now() / 1000);

      const domain = {
        name: DOMAIN_NAME,
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await listingRegistry.getAddress(),
      };

      const types = {
        Listing: [
          { name: "seller", type: "address" },
          { name: "uri", type: "string" },
          { name: "timestamp", type: "uint256" },
        ],
      };

      const value = {
        seller: seller.address,
        uri: uri,
        timestamp: timestamp,
      };

      const signature = await seller.signTypedData(domain, types, value);

      // First submission should work
      await listingRegistry.submitListingWithSig(seller.address, uri, timestamp, signature);

      // Reuse same signature with different timestamp should fail
      await expect(
        listingRegistry.submitListingWithSig(seller.address, uri, timestamp + 1, signature)
      ).to.be.revertedWith("Invalid signature");
    });
  });
});
