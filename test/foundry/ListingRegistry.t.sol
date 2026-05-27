// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../contracts/ListingRegistry.sol";

contract ListingRegistryTest is Test {
    ListingRegistry public registry;

    event ListingVerified(uint256 indexed listingId, address indexed seller, string uri, uint256 timestamp);
    event ListingRevoked(uint256 indexed listingId, address indexed seller, uint256 timestamp);

    address public owner;
    address public seller;
    address public other;
    address public attacker;

    uint256 public sellerKey;
    uint256 public otherKey;
    uint256 public attackerKey;

    bytes32 public constant TYPEHASH =
        keccak256("Listing(address seller,string uri,uint256 timestamp)");

    function setUp() public {
        // Generate keys
        sellerKey = 0xA11CE;
        otherKey = 0xB0B;
        attackerKey = 0xBAD;

        seller = vm.addr(sellerKey);
        other = vm.addr(otherKey);
        attacker = vm.addr(attackerKey);

        // Deploy as owner
        owner = address(this);
        registry = new ListingRegistry();
    }

    // ============ HELPERS ============

    function _signListing(
        uint256 signerKey,
        address sellerAddr,
        string memory uri,
        uint256 timestamp
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(abi.encode(TYPEHASH, sellerAddr, keccak256(bytes(uri)), timestamp));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", registry.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, digest);
        return abi.encodePacked(r, s, v);
    }

    // ============ DEPLOYMENT ============

    function test_deployerIsOwner() public view {
        assertEq(registry.owner(), owner);
    }

    function test_initialListingCountIsZero() public view {
        assertEq(registry.listingCount(), 0);
    }

    function test_domainSeparatorIsSet() public view {
        // Just verify it's non-zero (exact value depends on chainId and address)
        assertTrue(registry.DOMAIN_SEPARATOR() != bytes32(0));
    }

    function test_typehashIsCorrect() public view {
        assertEq(registry.TYPEHASH(), TYPEHASH);
    }

    // ============ SIGNATURE VALIDITY ============

    function test_submitWithValidSignature() public {
        string memory uri = "ipfs://QmTest123";
        uint256 timestamp = block.timestamp;
        bytes memory sig = _signListing(sellerKey, seller, uri, timestamp);

        uint256 id = registry.submitListingWithSig(seller, uri, timestamp, sig);
        assertEq(id, 0);

        (address storedSeller, string memory storedUri, uint256 storedTs, bool storedActive) = registry.listings(0);
        assertEq(storedSeller, seller);
        assertEq(storedUri, uri);
        assertEq(storedTs, timestamp);
        assertTrue(storedActive);
    }

    function test_anyoneCanSubmitValidSignedListing() public {
        string memory uri = "ipfs://QmAnySubmit";
        uint256 timestamp = block.timestamp;
        bytes memory sig = _signListing(sellerKey, seller, uri, timestamp);

        // 'other' submits a listing signed by 'seller'
        vm.prank(other);
        uint256 id = registry.submitListingWithSig(seller, uri, timestamp, sig);
        assertEq(id, 0);

        (address storedSeller, , , ) = registry.listings(0);
        assertEq(storedSeller, seller);
    }

    function test_emitsListingVerifiedEvent() public {
        string memory uri = "ipfs://QmEvent";
        uint256 timestamp = block.timestamp;
        bytes memory sig = _signListing(sellerKey, seller, uri, timestamp);

        vm.expectEmit(true, true, false, true);
        emit ListingVerified(0, seller, uri, timestamp);

        registry.submitListingWithSig(seller, uri, timestamp, sig);
    }

    function test_listingCountIncrements() public {
        uint256 ts = block.timestamp;

        bytes memory sig1 = _signListing(sellerKey, seller, "ipfs://1", ts);
        registry.submitListingWithSig(seller, "ipfs://1", ts, sig1);
        assertEq(registry.listingCount(), 1);

        bytes memory sig2 = _signListing(sellerKey, seller, "ipfs://2", ts + 1);
        registry.submitListingWithSig(seller, "ipfs://2", ts + 1, sig2);
        assertEq(registry.listingCount(), 2);
    }

    function test_correctSellerMapping() public {
        string memory uri = "ipfs://QmMapping";
        uint256 timestamp = block.timestamp;
        bytes memory sig = _signListing(sellerKey, seller, uri, timestamp);

        registry.submitListingWithSig(seller, uri, timestamp, sig);

        (address storedSeller, , , ) = registry.listings(0);
        assertEq(storedSeller, seller);
    }

    function test_correctMetadataStorage() public {
        string memory uri = "arweave://abc123def456";
        uint256 ts = 1700000000;
        bytes memory sig = _signListing(sellerKey, seller, uri, ts);

        registry.submitListingWithSig(seller, uri, ts, sig);

        (, string memory storedUri, uint256 storedTs, ) = registry.listings(0);
        assertEq(storedUri, uri);
        assertEq(storedTs, ts);
    }

    function test_emptyUri() public {
        uint256 ts = block.timestamp;
        bytes memory sig = _signListing(sellerKey, seller, "", ts);

        registry.submitListingWithSig(seller, "", ts, sig);

        (, string memory storedUri, , ) = registry.listings(0);
        assertEq(storedUri, "");
    }

    function test_longUri() public {
        string memory longUri = string.concat("ipfs://", "x", "x", "x", "x", "x"); // simplified
        uint256 ts = block.timestamp;
        bytes memory sig = _signListing(sellerKey, seller, longUri, ts);

        registry.submitListingWithSig(seller, longUri, ts, sig);

        (, string memory storedUri, , ) = registry.listings(0);
        assertEq(storedUri, longUri);
    }

    // ============ INVALID SIGNATURES ============

    function test_rejectWrongSigner() public {
        string memory uri = "ipfs://QmTest";
        uint256 ts = block.timestamp;
        // Attacker signs, but we claim it's from seller
        bytes memory sig = _signListing(attackerKey, seller, uri, ts);

        vm.expectRevert("Invalid signature");
        registry.submitListingWithSig(seller, uri, ts, sig);
    }

    function test_rejectWrongUri() public {
        uint256 ts = block.timestamp;
        bytes memory sig = _signListing(sellerKey, seller, "ipfs://ORIGINAL", ts);

        vm.expectRevert("Invalid signature");
        registry.submitListingWithSig(seller, "ipfs://TAMPERED", ts, sig);
    }

    function test_rejectWrongTimestamp() public {
        string memory uri = "ipfs://QmTest";
        uint256 ts = block.timestamp;
        bytes memory sig = _signListing(sellerKey, seller, uri, ts);

        vm.expectRevert("Invalid signature");
        registry.submitListingWithSig(seller, uri, ts + 1, sig);
    }

    function test_rejectWrongSellerAddress() public {
        string memory uri = "ipfs://QmTest";
        uint256 ts = block.timestamp;
        bytes memory sig = _signListing(sellerKey, seller, uri, ts);

        vm.expectRevert("Invalid signature");
        registry.submitListingWithSig(other, uri, ts, sig);
    }

    function test_rejectSignatureForWrongContract() public {
        string memory uri = "ipfs://QmTest";
        uint256 ts = block.timestamp;
        // Sign with a different contract address (attacker = fake contract)
        bytes32 fakeDomain = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("Nobay Listing")),
                block.chainid,
                attacker // fake contract address
            )
        );
        bytes32 structHash = keccak256(abi.encode(TYPEHASH, seller, keccak256(bytes(uri)), ts));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", fakeDomain, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(sellerKey, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.expectRevert("Invalid signature");
        registry.submitListingWithSig(seller, uri, ts, sig);
    }

    function test_rejectEmptySignature() public {
        vm.expectRevert();
        registry.submitListingWithSig(seller, "ipfs://x", block.timestamp, "");
    }

    function test_noReplayProtection() public {
        // Document: the contract does NOT prevent replay of same signature
        string memory uri = "ipfs://QmReplay";
        uint256 ts = block.timestamp;
        bytes memory sig = _signListing(sellerKey, seller, uri, ts);

        registry.submitListingWithSig(seller, uri, ts, sig);
        // Replay creates duplicate — this is documented behavior
        registry.submitListingWithSig(seller, uri, ts, sig);
        assertEq(registry.listingCount(), 2);
    }

    // ============ EVENT EMISSION ============

    function test_listingVerifiedEventOnSubmit() public {
        string memory uri = "ipfs://QmEvent";
        uint256 ts = block.timestamp;
        bytes memory sig = _signListing(sellerKey, seller, uri, ts);

        vm.expectEmit(true, true, false, true);
        emit ListingVerified(0, seller, uri, ts);

        registry.submitListingWithSig(seller, uri, ts, sig);
    }

    function test_listingRevokedEventOnRevoke() public {
        string memory uri = "ipfs://QmRevoke";
        uint256 ts = block.timestamp;
        bytes memory sig = _signListing(sellerKey, seller, uri, ts);
        registry.submitListingWithSig(seller, uri, ts, sig);

        vm.expectEmit(true, true, false, true);
        emit ListingRevoked(0, seller, block.timestamp);

        vm.prank(seller);
        registry.revokeListing(0);
    }

    function test_listingRevokedEventOnForceRevoke() public {
        string memory uri = "ipfs://QmForce";
        uint256 ts = block.timestamp;
        bytes memory sig = _signListing(sellerKey, seller, uri, ts);
        registry.submitListingWithSig(seller, uri, ts, sig);

        vm.expectEmit(true, true, false, true);
        emit ListingRevoked(0, seller, block.timestamp);

        registry.forceRevoke(0);
    }

    // ============ SELLER MAPPING & METADATA ============

    function test_multipleListingsFromSameSeller() public {
        uint256 ts = block.timestamp;

        for (uint256 i = 0; i < 3; i++) {
            string memory uri = string.concat("ipfs://Qm", vm.toString(i));
            bytes memory sig = _signListing(sellerKey, seller, uri, ts + i);
            registry.submitListingWithSig(seller, uri, ts + i, sig);
        }

        for (uint256 i = 0; i < 3; i++) {
            (address storedSeller, , uint256 storedTs, bool active) = registry.listings(i);
            assertEq(storedSeller, seller);
            assertEq(storedTs, ts + i);
            assertTrue(active);
        }
    }

    function test_listingsFromDifferentSellers() public {
        uint256 ts = block.timestamp;

        bytes memory sig1 = _signListing(sellerKey, seller, "ipfs://s1", ts);
        registry.submitListingWithSig(seller, "ipfs://s1", ts, sig1);

        bytes memory sig2 = _signListing(otherKey, other, "ipfs://o1", ts + 1);
        registry.submitListingWithSig(other, "ipfs://o1", ts + 1, sig2);

        (address s0, , , ) = registry.listings(0);
        (address s1, , , ) = registry.listings(1);
        assertEq(s0, seller);
        assertEq(s1, other);
    }

    function test_listingCountAfterRevoke() public {
        uint256 ts = block.timestamp;

        for (uint256 i = 0; i < 3; i++) {
            string memory uri = string.concat("ipfs://Qm", vm.toString(i));
            bytes memory sig = _signListing(sellerKey, seller, uri, ts + i);
            registry.submitListingWithSig(seller, uri, ts + i, sig);
        }
        assertEq(registry.listingCount(), 3);

        vm.prank(seller);
        registry.revokeListing(1);
        // Count should NOT decrease
        assertEq(registry.listingCount(), 3);
    }

    function test_metadataPreservedAfterRevoke() public {
        string memory uri = "ipfs://QmRevokeMeta";
        uint256 ts = block.timestamp;
        bytes memory sig = _signListing(sellerKey, seller, uri, ts);
        registry.submitListingWithSig(seller, uri, ts, sig);

        vm.prank(seller);
        registry.revokeListing(0);

        (address storedSeller, string memory storedUri, uint256 storedTs, bool active) = registry.listings(0);
        assertEq(storedSeller, seller);
        assertEq(storedUri, uri);
        assertEq(storedTs, ts);
        assertFalse(active); // Only active flag changes
    }

    // ============ REVOKE LISTING ============

    function test_sellerCanRevokeOwnListing() public {
        string memory uri = "ipfs://QmRevoke";
        uint256 ts = block.timestamp;
        bytes memory sig = _signListing(sellerKey, seller, uri, ts);
        registry.submitListingWithSig(seller, uri, ts, sig);

        vm.prank(seller);
        registry.revokeListing(0);

        (, , , bool active) = registry.listings(0);
        assertFalse(active);
    }

    function test_nonSellerCannotRevoke() public {
        string memory uri = "ipfs://QmRevoke";
        uint256 ts = block.timestamp;
        bytes memory sig = _signListing(sellerKey, seller, uri, ts);
        registry.submitListingWithSig(seller, uri, ts, sig);

        vm.prank(attacker);
        vm.expectRevert("Not your listing");
        registry.revokeListing(0);
    }

    function test_cannotRevokeInactiveListing() public {
        string memory uri = "ipfs://QmRevoke";
        uint256 ts = block.timestamp;
        bytes memory sig = _signListing(sellerKey, seller, uri, ts);
        registry.submitListingWithSig(seller, uri, ts, sig);

        vm.startPrank(seller);
        registry.revokeListing(0);

        vm.expectRevert("Already inactive");
        registry.revokeListing(0);
        vm.stopPrank();
    }

    // ============ FORCE REVOKE (OWNER) ============

    function test_ownerCanForceRevoke() public {
        string memory uri = "ipfs://QmForce";
        uint256 ts = block.timestamp;
        bytes memory sig = _signListing(sellerKey, seller, uri, ts);
        registry.submitListingWithSig(seller, uri, ts, sig);

        registry.forceRevoke(0);

        (, , , bool active) = registry.listings(0);
        assertFalse(active);
    }

    function test_nonOwnerCannotForceRevoke() public {
        string memory uri = "ipfs://QmForce";
        uint256 ts = block.timestamp;
        bytes memory sig = _signListing(sellerKey, seller, uri, ts);
        registry.submitListingWithSig(seller, uri, ts, sig);

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", attacker));
        registry.forceRevoke(0);
    }

    function test_forceRevokeEmitsSellerAddress() public {
        string memory uri = "ipfs://QmForce";
        uint256 ts = block.timestamp;
        bytes memory sig = _signListing(sellerKey, seller, uri, ts);
        registry.submitListingWithSig(seller, uri, ts, sig);

        vm.expectEmit(true, true, false, true);
        emit ListingRevoked(0, seller, block.timestamp);

        registry.forceRevoke(0);
    }

    function test_forceRevokeOnInactiveListing() public {
        string memory uri = "ipfs://QmForce";
        uint256 ts = block.timestamp;
        bytes memory sig = _signListing(sellerKey, seller, uri, ts);
        registry.submitListingWithSig(seller, uri, ts, sig);

        // First revoke normally
        vm.prank(seller);
        registry.revokeListing(0);

        // forceRevoke on already inactive should NOT revert (no active check)
        registry.forceRevoke(0);
    }

    // ============ EDGE CASES ============

    function test_sequentialIncrementingIds() public {
        uint256 ts = block.timestamp;

        for (uint256 i = 0; i < 5; i++) {
            string memory uri = string.concat("ipfs://Qm", vm.toString(i));
            bytes memory sig = _signListing(sellerKey, seller, uri, ts + i);
            uint256 id = registry.submitListingWithSig(seller, uri, ts + i, sig);
            assertEq(id, i);
        }
        assertEq(registry.listingCount(), 5);
    }

    function test_timestampZero() public {
        bytes memory sig = _signListing(sellerKey, seller, "ipfs://zero", 0);
        registry.submitListingWithSig(seller, "ipfs://zero", 0, sig);

        (, , uint256 storedTs, ) = registry.listings(0);
        assertEq(storedTs, 0);
    }

    function test_nonExistentListingReturnsDefaults() public view {
        (address addr, string memory uri, uint256 ts, bool active) = registry.listings(999);
        assertEq(addr, address(0));
        assertEq(uri, "");
        assertEq(ts, 0);
        assertFalse(active);
    }
}
