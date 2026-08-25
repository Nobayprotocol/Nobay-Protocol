const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ListingRegistry", function () {
  let ListingRegistry;
  let registry;
  let owner;
  let seller;
  let attacker;

  const uri = "ipfs://QmTestHash123456789";
  const timestamp = 1700000000n;

  const domain = (contractAddr, chainId) => ({
    name: "Nobay Listing",
    chainId: chainId,
    verifyingContract: contractAddr,
  });

  const types = {
    Listing: [
      { name: "seller", type: "address" },
      { name: "uri", type: "string" },
      { name: "timestamp", type: "uint256" },
    ],
  };

  async function signListing(signer, contractAddr, chainId, sellerAddr, uriStr, ts) {
    const value = {
      seller: sellerAddr,
      uri: uriStr,
      timestamp: ts,
    };
    return await signer.signTypedData(domain(contractAddr, chainId), types, value);
  }

  beforeEach(async function () {
    [owner, seller, attacker] = await ethers.getSigners();
    ListingRegistry = await ethers.getContractFactory("ListingRegistry");
    registry = await ListingRegistry.deploy();
    await registry.waitForDeployment();
  });

  function getDomainSeparator(contractAddr, chainId) {
    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "bytes32", "uint256", "address"],
        [
          ethers.keccak256(
            ethers.toUtf8Bytes("EIP712Domain(string name,uint256 chainId,address verifyingContract)")
          ),
          ethers.keccak256(ethers.toUtf8Bytes("Nobay Listing")),
          chainId,
          contractAddr,
        ]
      )
    );
  }

  describe("Deployment", function () {
    it("Should set the deployer as owner", async function () {
      expect(await registry.owner()).to.equal(owner.address);
    });

    it("Should initialize listingCount to 0", async function () {
      expect(await registry.listingCount()).to.equal(0);
    });

    it("Should set DOMAIN_SEPARATOR correctly", async function () {
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const expected = getDomainSeparator(await registry.getAddress(), chainId);
      expect(await registry.DOMAIN_SEPARATOR()).to.equal(expected);
    });
  });

  describe("submitListingWithSig", function () {
    it("Should verify a listing with a valid EIP-712 signature", async function () {
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const contractAddr = await registry.getAddress();
      const signature = await signListing(
        seller, contractAddr, chainId, seller.address, uri, timestamp
      );

      const tx = await registry.submitListingWithSig(
        seller.address, uri, timestamp, signature
      );
      await tx.wait();

      expect(await registry.listingCount()).to.equal(1);

      const listing = await registry.listings(0);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.uri).to.equal(uri);
      expect(listing.timestamp).to.equal(timestamp);
      expect(listing.active).to.equal(true);
    });

    it("Should emit ListingVerified event on successful submission", async function () {
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const contractAddr = await registry.getAddress();
      const signature = await signListing(
        seller, contractAddr, chainId, seller.address, uri, timestamp
      );

      await expect(
        registry.submitListingWithSig(seller.address, uri, timestamp, signature)
      ).to.emit(registry, "ListingVerified")
        .withArgs(0, seller.address, uri, timestamp);
    });

    it("Should reject an invalid signature (wrong signer)", async function () {
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const contractAddr = await registry.getAddress();
      const badSig = await signListing(
        attacker, contractAddr, chainId, seller.address, uri, timestamp
      );

      await expect(
        registry.submitListingWithSig(seller.address, uri, timestamp, badSig)
      ).to.be.revertedWith("Invalid signature");
    });

    it("Should reject a tampered URI in signature", async function () {
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const contractAddr = await registry.getAddress();
      const signature = await signListing(
        seller, contractAddr, chainId, seller.address, uri, timestamp
      );

      await expect(
        registry.submitListingWithSig(
          seller.address, "ipfs://DifferentHash", timestamp, signature
        )
      ).to.be.revertedWith("Invalid signature");
    });

    it("Should reject a tampered timestamp in signature", async function () {
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const contractAddr = await registry.getAddress();
      const signature = await signListing(
        seller, contractAddr, chainId, seller.address, uri, timestamp
      );

      await expect(
        registry.submitListingWithSig(seller.address, uri, timestamp + 1n, signature)
      ).to.be.revertedWith("Invalid signature");
    });

    it("Should allow multiple listings and increment listingCount", async function () {
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const contractAddr = await registry.getAddress();

      const sig1 = await signListing(
        seller, contractAddr, chainId, seller.address, uri, timestamp
      );
      await registry.submitListingWithSig(seller.address, uri, timestamp, sig1);

      const uri2 = "ipfs://QmSecondHash987654321";
      const ts2 = 1700000001n;
      const sig2 = await signListing(
        seller, contractAddr, chainId, seller.address, uri2, ts2
      );
      await registry.submitListingWithSig(seller.address, uri2, ts2, sig2);

      expect(await registry.listingCount()).to.equal(2);

      const l1 = await registry.listings(0);
      const l2 = await registry.listings(1);
      expect(l1.uri).to.equal(uri);
      expect(l2.uri).to.equal(uri2);
    });
  });

  describe("revokeListing", function () {
    beforeEach(async function () {
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const contractAddr = await registry.getAddress();
      const signature = await signListing(
        seller, contractAddr, chainId, seller.address, uri, timestamp
      );
      await registry.submitListingWithSig(seller.address, uri, timestamp, signature);
    });

    it("Should allow seller to revoke their listing", async function () {
      await registry.connect(seller).revokeListing(0);
      const listing = await registry.listings(0);
      expect(listing.active).to.equal(false);
    });

    it("Should emit ListingRevoked event on revoke", async function () {
      const tx = await registry.connect(seller).revokeListing(0);
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (l) => {
          const parsed = registry.interface.parseLog(l);
          return parsed && parsed.name === "ListingRevoked";
        }
      );
      expect(event).to.not.be.undefined;
      const parsed = registry.interface.parseLog(event);
      expect(parsed.args.listingId).to.equal(0);
      expect(parsed.args.seller).to.equal(seller.address);
    });

    it("Should reject revocation from non-seller", async function () {
      await expect(
        registry.connect(attacker).revokeListing(0)
      ).to.be.revertedWith("Not your listing");
    });

    it("Should reject double revocation", async function () {
      await registry.connect(seller).revokeListing(0);
      await expect(
        registry.connect(seller).revokeListing(0)
      ).to.be.revertedWith("Already inactive");
    });
  });

  describe("forceRevoke", function () {
    beforeEach(async function () {
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const contractAddr = await registry.getAddress();
      const signature = await signListing(
        seller, contractAddr, chainId, seller.address, uri, timestamp
      );
      await registry.submitListingWithSig(seller.address, uri, timestamp, signature);
    });

    it("Should allow owner to forceRevoke any listing", async function () {
      await registry.connect(owner).forceRevoke(0);
      const listing = await registry.listings(0);
      expect(listing.active).to.equal(false);
    });

    it("Should emit ListingRevoked on forceRevoke", async function () {
      const tx = await registry.connect(owner).forceRevoke(0);
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (l) => {
          const parsed = registry.interface.parseLog(l);
          return parsed && parsed.name === "ListingRevoked";
        }
      );
      expect(event).to.not.be.undefined;
    });

    it("Should reject forceRevoke from non-owner", async function () {
      await expect(
        registry.connect(attacker).forceRevoke(0)
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });

    it("Should reject forceRevoke from seller (non-owner)", async function () {
      await expect(
        registry.connect(seller).forceRevoke(0)
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });
  });

  describe("Metadata accuracy", function () {
    it("Should store accurate seller, uri, timestamp for each listing", async function () {
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const contractAddr = await registry.getAddress();

      const uriA = "ipfs://QmMetadataA";
      const tsA = 1700000100n;
      const sigA = await signListing(
        seller, contractAddr, chainId, seller.address, uriA, tsA
      );
      await registry.submitListingWithSig(seller.address, uriA, tsA, sigA);

      const uriB = "ipfs://QmMetadataB";
      const tsB = 1700000200n;
      const sigB = await signListing(
        seller, contractAddr, chainId, seller.address, uriB, tsB
      );
      await registry.submitListingWithSig(seller.address, uriB, tsB, sigB);

      const lA = await registry.listings(0);
      const lB = await registry.listings(1);

      expect(lA.seller).to.equal(seller.address);
      expect(lA.uri).to.equal(uriA);
      expect(lA.timestamp).to.equal(tsA);
      expect(lA.active).to.equal(true);

      expect(lB.seller).to.equal(seller.address);
      expect(lB.uri).to.equal(uriB);
      expect(lB.timestamp).to.equal(tsB);
      expect(lB.active).to.equal(true);
    });
  });
});
