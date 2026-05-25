const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("ListingRegistry", function () {
  const NAME = "Nobay Listing";
  const TYPEHASH = ethers.keccak256(
    ethers.toUtf8Bytes("Listing(address seller,string uri,uint256 timestamp)")
  );
  const DEFAULT_URI = "ipfs://bafybeigdyrzt-test-listing";
  const DEFAULT_TIMESTAMP = 1_725_000_000;

  let registry;
  let owner;
  let seller;
  let relayer;
  let other;
  let domain;
  let types;

  beforeEach(async function () {
    [owner, seller, relayer, other] = await ethers.getSigners();

    const Registry = await ethers.getContractFactory("ListingRegistry");
    registry = await Registry.deploy();
    await registry.waitForDeployment();

    const network = await ethers.provider.getNetwork();
    domain = {
      name: NAME,
      chainId: network.chainId,
      verifyingContract: await registry.getAddress(),
    };
    types = {
      Listing: [
        { name: "seller", type: "address" },
        { name: "uri", type: "string" },
        { name: "timestamp", type: "uint256" },
      ],
    };
  });

  async function signListing(
    signer = seller,
    listedSeller = seller.address,
    uri = DEFAULT_URI,
    timestamp = DEFAULT_TIMESTAMP
  ) {
    return signer.signTypedData(domain, types, {
      seller: listedSeller,
      uri,
      timestamp,
    });
  }

  async function submitListing(
    listedSeller = seller.address,
    uri = DEFAULT_URI,
    timestamp = DEFAULT_TIMESTAMP,
    signer = seller,
    caller = relayer
  ) {
    const signature = await signListing(signer, listedSeller, uri, timestamp);
    const tx = await registry
      .connect(caller)
      .submitListingWithSig(listedSeller, uri, timestamp, signature);

    return { tx, signature };
  }

  it("sets the EIP-712 domain separator for Nobay listings", async function () {
    expect(await registry.TYPEHASH()).to.equal(TYPEHASH);
    expect(await registry.DOMAIN_SEPARATOR()).to.equal(
      ethers.TypedDataEncoder.hashDomain(domain)
    );
  });

  it("accepts a valid seller signature and stores listing metadata", async function () {
    await submitListing();

    const listing = await registry.listings(0);
    expect(listing.seller).to.equal(seller.address);
    expect(listing.uri).to.equal(DEFAULT_URI);
    expect(listing.timestamp).to.equal(DEFAULT_TIMESTAMP);
    expect(listing.active).to.equal(true);
    expect(await registry.listingCount()).to.equal(1);
  });

  it("emits ListingVerified for a valid signature", async function () {
    const signature = await signListing();

    await expect(
      registry
        .connect(relayer)
        .submitListingWithSig(seller.address, DEFAULT_URI, DEFAULT_TIMESTAMP, signature)
    )
      .to.emit(registry, "ListingVerified")
      .withArgs(0, seller.address, DEFAULT_URI, DEFAULT_TIMESTAMP);
  });

  it("allows a relayer to submit a valid listing signed by the seller", async function () {
    const { tx } = await submitListing();

    await expect(tx)
      .to.emit(registry, "ListingVerified")
      .withArgs(0, seller.address, DEFAULT_URI, DEFAULT_TIMESTAMP);
  });

  it("rejects signatures from the wrong signer", async function () {
    const signature = await signListing(other, seller.address);

    await expect(
      registry
        .connect(relayer)
        .submitListingWithSig(seller.address, DEFAULT_URI, DEFAULT_TIMESTAMP, signature)
    ).to.be.revertedWith("Invalid signature");
  });

  it("rejects signatures when seller, URI, or timestamp is changed", async function () {
    const signature = await signListing();

    await expect(
      registry
        .connect(relayer)
        .submitListingWithSig(other.address, DEFAULT_URI, DEFAULT_TIMESTAMP, signature)
    ).to.be.revertedWith("Invalid signature");

    await expect(
      registry
        .connect(relayer)
        .submitListingWithSig(seller.address, "ipfs://tampered", DEFAULT_TIMESTAMP, signature)
    ).to.be.revertedWith("Invalid signature");

    await expect(
      registry
        .connect(relayer)
        .submitListingWithSig(seller.address, DEFAULT_URI, DEFAULT_TIMESTAMP + 1, signature)
    ).to.be.revertedWith("Invalid signature");
  });

  it("stores multiple listings with accurate seller and metadata fields", async function () {
    await submitListing(seller.address, "ipfs://listing-one", 10);
    await submitListing(seller.address, "ipfs://listing-two", 11);

    const first = await registry.listings(0);
    const second = await registry.listings(1);

    expect(await registry.listingCount()).to.equal(2);
    expect(first.seller).to.equal(seller.address);
    expect(first.uri).to.equal("ipfs://listing-one");
    expect(first.timestamp).to.equal(10);
    expect(first.active).to.equal(true);
    expect(second.seller).to.equal(seller.address);
    expect(second.uri).to.equal("ipfs://listing-two");
    expect(second.timestamp).to.equal(11);
    expect(second.active).to.equal(true);
  });

  it("allows the seller to revoke a listing and emits ListingRevoked", async function () {
    await submitListing();

    await expect(registry.connect(seller).revokeListing(0))
      .to.emit(registry, "ListingRevoked")
      .withArgs(0, seller.address, anyValue);

    const listing = await registry.listings(0);
    expect(listing.active).to.equal(false);
    expect(listing.seller).to.equal(seller.address);
    expect(listing.uri).to.equal(DEFAULT_URI);
  });

  it("rejects revoke attempts from non-sellers and repeat revokes", async function () {
    await submitListing();

    await expect(registry.connect(other).revokeListing(0)).to.be.revertedWith(
      "Not your listing"
    );

    await registry.connect(seller).revokeListing(0);
    await expect(registry.connect(seller).revokeListing(0)).to.be.revertedWith(
      "Already inactive"
    );
  });

  it("allows only the owner to force revoke listings", async function () {
    await submitListing();

    await expect(registry.connect(other).forceRevoke(0)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );

    await expect(registry.connect(owner).forceRevoke(0))
      .to.emit(registry, "ListingRevoked")
      .withArgs(0, seller.address, anyValue);

    expect((await registry.listings(0)).active).to.equal(false);
  });
});
