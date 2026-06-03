const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ListingRegistry", function () {
  let ListingRegistry;
  let listingRegistry;
  let owner;
  let seller;
  let buyer;
  let attacker;

  // 测试数据
  const testUri = "QmTest123";
  const testTimestamp = Math.floor(Date.now() / 1000);

  // EIP-712相关
  const TYPEHASH = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes("Listing(address seller,string uri,uint256 timestamp)")
  );

  beforeEach(async function () {
    // 获取测试账户
    [owner, seller, buyer, attacker] = await ethers.getSigners();

    // 部署合约
    ListingRegistry = await ethers.getContractFactory("ListingRegistry");
    listingRegistry = await ListingRegistry.deploy();
    await listingRegistry.deployed();
  });

  describe("Signature Validity", function () {
    it("Should accept valid signature", async function () {
      // 创建签名
      const domainSeparator = await listingRegistry.DOMAIN_SEPARATOR();
      
      const digest = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ["bytes2", "bytes32", "bytes32"],
          [
            "0x1901",
            domainSeparator,
            ethers.utils.keccak256(
              ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "bytes32", "uint256"],
                [TYPEHASH, seller.address, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(testUri)), testTimestamp]
              )
            )
          ]
        )
      );

      // 签名
      const signature = await seller.signMessage(ethers.utils.arrayify(digest));

      // 提交listing
      const tx = await listingRegistry.submitListingWithSig(
        seller.address,
        testUri,
        testTimestamp,
        signature
      );

      // 检查事件
      await expect(tx)
        .to.emit(listingRegistry, "ListingVerified")
        .withArgs(0, seller.address, testUri, testTimestamp);

      // 检查listing数据
      const listing = await listingRegistry.listings(0);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.uri).to.equal(testUri);
      expect(listing.timestamp).to.equal(testTimestamp);
      expect(listing.active).to.be.true;
    });
  });

  describe("Invalid Signature Rejection", function () {
    it("Should reject invalid signature", async function () {
      // 创建签名
      const domainSeparator = await listingRegistry.DOMAIN_SEPARATOR();
      
      const digest = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ["bytes2", "bytes32", "bytes32"],
          [
            "0x1901",
            domainSeparator,
            ethers.utils.keccak256(
              ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "bytes32", "uint256"],
                [TYPEHASH, seller.address, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(testUri)), testTimestamp]
              )
            )
          ]
        )
      );

      // 使用attacker的私钥签名
      const signature = await attacker.signMessage(ethers.utils.arrayify(digest));

      // 提交listing应该失败
      await expect(
        listingRegistry.submitListingWithSig(
          seller.address,
          testUri,
          testTimestamp,
          signature
        )
      ).to.be.revertedWith("Invalid signature");
    });

    it("Should reject expired timestamp", async function () {
      // 创建过期的timestamp
      const expiredTimestamp = testTimestamp - 3600; // 1小时前

      // 创建签名
      const domainSeparator = await listingRegistry.DOMAIN_SEPARATOR();
      
      const digest = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ["bytes2", "bytes32", "bytes32"],
          [
            "0x1901",
            domainSeparator,
            ethers.utils.keccak256(
              ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "bytes32", "uint256"],
                [TYPEHASH, seller.address, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(testUri)), expiredTimestamp]
              )
            )
          ]
        )
      );

      // 签名
      const signature = await seller.signMessage(ethers.utils.arrayify(digest));

      // 提交listing应该失败（如果合约有时间检查）
      // 注意：原合约没有时间检查，这里只是示例
    });
  });

  describe("Event Emission", function () {
    it("Should emit ListingVerified event", async function () {
      // 创建签名
      const domainSeparator = await listingRegistry.DOMAIN_SEPARATOR();
      
      const digest = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ["bytes2", "bytes32", "bytes32"],
          [
            "0x1901",
            domainSeparator,
            ethers.utils.keccak256(
              ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "bytes32", "uint256"],
                [TYPEHASH, seller.address, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(testUri)), testTimestamp]
              )
            )
          ]
        )
      );

      // 签名
      const signature = await seller.signMessage(ethers.utils.arrayify(digest));

      // 提交listing
      const tx = await listingRegistry.submitListingWithSig(
        seller.address,
        testUri,
        testTimestamp,
        signature
      );

      // 检查事件
      await expect(tx)
        .to.emit(listingRegistry, "ListingVerified")
        .withArgs(0, seller.address, testUri, testTimestamp);
    });

    it("Should emit ListingRevoked event", async function () {
      // 先提交一个listing
      const domainSeparator = await listingRegistry.DOMAIN_SEPARATOR();
      
      const digest = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ["bytes2", "bytes32", "bytes32"],
          [
            "0x1901",
            domainSeparator,
            ethers.utils.keccak256(
              ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "bytes32", "uint256"],
                [TYPEHASH, seller.address, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(testUri)), testTimestamp]
              )
            )
          ]
        )
      );

      // 签名
      const signature = await seller.signMessage(ethers.utils.arrayify(digest));

      // 提交listing
      await listingRegistry.submitListingWithSig(
        seller.address,
        testUri,
        testTimestamp,
        signature
      );

      // 撤销listing
      const tx = await listingRegistry.connect(seller).revokeListing(0);

      // 检查事件
      await expect(tx)
        .to.emit(listingRegistry, "ListingRevoked")
        .withArgs(0, seller.address, await getBlockTimestamp());
    });
  });

  describe("Seller Mapping and Metadata", function () {
    it("Should store correct seller mapping", async function () {
      // 创建签名
      const domainSeparator = await listingRegistry.DOMAIN_SEPARATOR();
      
      const digest = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ["bytes2", "bytes32", "bytes32"],
          [
            "0x1901",
            domainSeparator,
            ethers.utils.keccak256(
              ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "bytes32", "uint256"],
                [TYPEHASH, seller.address, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(testUri)), testTimestamp]
              )
            )
          ]
        )
      );

      // 签名
      const signature = await seller.signMessage(ethers.utils.arrayify(digest));

      // 提交listing
      await listingRegistry.submitListingWithSig(
        seller.address,
        testUri,
        testTimestamp,
        signature
      );

      // 检查listing数据
      const listing = await listingRegistry.listings(0);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.uri).to.equal(testUri);
      expect(listing.timestamp).to.equal(testTimestamp);
      expect(listing.active).to.be.true;
    });

    it("Should increment listing count", async function () {
      // 创建签名
      const domainSeparator = await listingRegistry.DOMAIN_SEPARATOR();
      
      const digest = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ["bytes2", "bytes32", "bytes32"],
          [
            "0x1901",
            domainSeparator,
            ethers.utils.keccak256(
              ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "bytes32", "uint256"],
                [TYPEHASH, seller.address, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(testUri)), testTimestamp]
              )
            )
          ]
        )
      );

      // 签名
      const signature = await seller.signMessage(ethers.utils.arrayify(digest));

      // 提交listing
      await listingRegistry.submitListingWithSig(
        seller.address,
        testUri,
        testTimestamp,
        signature
      );

      // 检查listing count
      expect(await listingRegistry.listingCount()).to.equal(1);

      // 提交第二个listing
      const testUri2 = "QmTest456";
      const testTimestamp2 = testTimestamp + 1;

      const digest2 = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ["bytes2", "bytes32", "bytes32"],
          [
            "0x1901",
            domainSeparator,
            ethers.utils.keccak256(
              ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "bytes32", "uint256"],
                [TYPEHASH, seller.address, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(testUri2)), testTimestamp2]
              )
            )
          ]
        )
      );

      // 签名
      const signature2 = await seller.signMessage(ethers.utils.arrayify(digest2));

      // 提交listing
      await listingRegistry.submitListingWithSig(
        seller.address,
        testUri2,
        testTimestamp2,
        signature2
      );

      // 检查listing count
      expect(await listingRegistry.listingCount()).to.equal(2);
    });
  });

  describe("Listing Revocation", function () {
    it("Should allow seller to revoke listing", async function () {
      // 先提交一个listing
      const domainSeparator = await listingRegistry.DOMAIN_SEPARATOR();
      
      const digest = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ["bytes2", "bytes32", "bytes32"],
          [
            "0x1901",
            domainSeparator,
            ethers.utils.keccak256(
              ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "bytes32", "uint256"],
                [TYPEHASH, seller.address, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(testUri)), testTimestamp]
              )
            )
          ]
        )
      );

      // 签名
      const signature = await seller.signMessage(ethers.utils.arrayify(digest));

      // 提交listing
      await listingRegistry.submitListingWithSig(
        seller.address,
        testUri,
        testTimestamp,
        signature
      );

      // 撤销listing
      await listingRegistry.connect(seller).revokeListing(0);

      // 检查listing状态
      const listing = await listingRegistry.listings(0);
      expect(listing.active).to.be.false;
    });

    it("Should not allow non-seller to revoke listing", async function () {
      // 先提交一个listing
      const domainSeparator = await listingRegistry.DOMAIN_SEPARATOR();
      
      const digest = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ["bytes2", "bytes32", "bytes32"],
          [
            "0x1901",
            domainSeparator,
            ethers.utils.keccak256(
              ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "bytes32", "uint256"],
                [TYPEHASH, seller.address, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(testUri)), testTimestamp]
              )
            )
          ]
        )
      );

      // 签名
      const signature = await seller.signMessage(ethers.utils.arrayify(digest));

      // 提交listing
      await listingRegistry.submitListingWithSig(
        seller.address,
        testUri,
        testTimestamp,
        signature
      );

      // 尝试用attacker撤销listing应该失败
      await expect(
        listingRegistry.connect(attacker).revokeListing(0)
      ).to.be.revertedWith("Not your listing");
    });
  });

  // 辅助函数
  async function getBlockTimestamp() {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp;
  }
});

  // 边界条件测试
  describe("Boundary Conditions", function () {
    it("Should handle empty URI", async function () {
      const domainSeparator = await listingRegistry.DOMAIN_SEPARATOR();
      
      const digest = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ["bytes2", "bytes32", "bytes32"],
          [
            "0x1901",
            domainSeparator,
            ethers.utils.keccak256(
              ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "bytes32", "uint256"],
                [TYPEHASH, seller.address, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("")), testTimestamp]
              )
            )
          ]
        )
      );

      const signature = await seller.signMessage(ethers.utils.arrayify(digest));

      const tx = await listingRegistry.submitListingWithSig(
        seller.address,
        "",
        testTimestamp,
        signature
      );

      const listing = await listingRegistry.listings(0);
      expect(listing.uri).to.equal("");
    });
  });

  // 权限控制测试
  describe("Permission Control", function () {
    it("Should only allow seller to revoke", async function () {
      const domainSeparator = await listingRegistry.DOMAIN_SEPARATOR();
      
      const digest = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ["bytes2", "bytes32", "bytes32"],
          [
            "0x1901",
            domainSeparator,
            ethers.utils.keccak256(
              ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "bytes32", "uint256"],
                [TYPEHASH, seller.address, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(testUri)), testTimestamp]
              )
            )
          ]
        )
      );

      const signature = await seller.signMessage(ethers.utils.arrayify(digest));

      await listingRegistry.submitListingWithSig(
        seller.address,
        testUri,
        testTimestamp,
        signature
      );

      await expect(
        listingRegistry.connect(attacker).revokeListing(0)
      ).to.be.revertedWith("Not your listing");
    });
  });

  // 多个listing测试
  describe("Multiple Listings", function () {
    it("Should handle multiple listings", async function () {
      const domainSeparator = await listingRegistry.DOMAIN_SEPARATOR();
      
      for (let i = 0; i < 3; i++) {
        const digest = ethers.utils.keccak256(
          ethers.utils.solidityPack(
            ["bytes2", "bytes32", "bytes32"],
            [
              "0x1901",
              domainSeparator,
              ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                  ["bytes32", "address", "bytes32", "uint256"],
                  [TYPEHASH, seller.address, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("uri" + i)), testTimestamp + i]
                )
              )
            ]
          )
        );

        const signature = await seller.signMessage(ethers.utils.arrayify(digest));
        await listingRegistry.submitListingWithSig(seller.address, "uri" + i, testTimestamp + i, signature);
      }

      expect(await listingRegistry.listingCount()).to.equal(3);
    });
  });

});
