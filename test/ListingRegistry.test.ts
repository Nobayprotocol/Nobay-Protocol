import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ListingRegistry } from "../typechain-types";

describe("ListingRegistry", function () {
  let registry: ListingRegistry;
  let owner: SignerWithAddress;
  let seller: SignerWithAddress;
  let other: SignerWithAddress;

  beforeEach(async function () {
    [owner, seller, other] = await ethers.getSigners();
    const RegistryFactory = await ethers.getContractFactory("ListingRegistry");
    registry = await RegistryFactory.deploy();
  });

  it("Should verify a valid signature and emit event", async function () {
    const uri = "ipfs://QmTest123";
    const timestamp = Math.floor(Date.now() / 1000);

    const domain = {
      name: "Nobay Listing",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await registry.getAddress()
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
      uri: uri,
      timestamp: timestamp
    };

    const signature = await seller.signTypedData(domain, types, value);

    await expect(registry.connect(other).submitListingWithSig(seller.address, uri, timestamp, signature))
      .to.emit(registry, "ListingVerified")
      .withArgs(0, seller.address, uri, timestamp);

    const listing = await registry.listings(0);
    expect(listing.seller).to.equal(seller.address);
    expect(listing.uri).to.equal(uri);
    expect(listing.active).to.be.true;
  });

  it("Should reject an invalid signature", async function () {
    const uri = "ipfs://QmTest123";
    const timestamp = Math.floor(Date.now() / 1000);

    const domain = {
      name: "Nobay Listing",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await registry.getAddress()
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
      uri: uri,
      timestamp: timestamp
    };

    const signature = await other.signTypedData(domain, types, value);

    await expect(
      registry.submitListingWithSig(seller.address, uri, timestamp, signature)
    ).to.be.revertedWith("Invalid signature");
  });
});
