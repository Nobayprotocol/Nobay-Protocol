import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("ListingRegistry", function () {
  async function deployRegistryFixture() {
    const [owner, seller, attacker] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("ListingRegistry");
    const registry = await Registry.deploy();
    return { registry, owner, seller, attacker };
  }

  const getDomain = async (registry: any) => ({
    name: "Nobay Listing",
    chainId: (await ethers.provider.getNetwork()).chainId,
    verifyingContract: await registry.getAddress()
  });

  const types = {
    Listing: [
      { name: "seller", type: "address" },
      { name: "uri", type: "string" },
      { name: "timestamp", type: "uint256" }
    ]
  };

  describe("EIP-712 Signature Verification", function () {
    it("Should successfully verify and store a valid signed listing", async function () {
      const { registry, seller } = await loadFixture(deployRegistryFixture);
      
      const uri = "ipfs://QmTest123";
      const timestamp = Math.floor(Date.now() / 1000);
      
      const value = { seller: seller.address, uri, timestamp };
      const signature = await seller.signTypedData(await getDomain(registry), types, value);
      
      await expect(registry.submitListingWithSig(seller.address, uri, timestamp, signature))
        .to.emit(registry, "ListingVerified")
        .withArgs(0, seller.address, uri, timestamp);
    });
  });
});
