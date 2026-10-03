pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/ListingRegistry.sol";

contract ListingRegistryTest is Test {
    ListingRegistry registry;
    address seller = address(0x1001);
    address other = address(0x1002);

    function setUp() public {
        registry = new ListingRegistry();
        vm.deal(seller, 10 ether);
        vm.deal(other, 10 ether);
    }

    function testValidSignatureEmitsEventAndStoresMetadata() public {
        bytes32 listingId = keccak256("listing-1");
        address token = address(0xBEEF);
        uint256 tokenId = 1;
        uint256 price = 1 ether;
        uint256 expiresAt = block.timestamp + 1 hours;

        bytes32 digest = registry.getListingDigest(listingId, seller, token, tokenId, price, expiresAt);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(uint256(uint160(seller)), digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.expectEmit(true, true, false, true);
        emit ListingRegistry.ListingCreated(listingId, seller, token, tokenId, price, expiresAt);

        registry.createListing(listingId, seller, token, tokenId, price, expiresAt, sig);

        ListingRegistry.Listing memory stored = registry.listings(listingId);
        assertEq(stored.seller, seller);
        assertEq(stored.token, token);
        assertEq(stored.tokenId, tokenId);
        assertEq(stored.price, price);
    }

    function testRejectInvalidSignature() public {
        bytes32 listingId = keccak256("listing-2");
        address token = address(0xBEEF);
        uint256 tokenId = 2;
        uint256 price = 1 ether;
        uint256 expiresAt = block.timestamp + 1 hours;

        bytes32 digest = registry.getListingDigest(listingId, seller, token, tokenId, price, expiresAt);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(uint256(uint160(other)), digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.expectRevert(ListingRegistry.InvalidSignature.selector);
        registry.createListing(listingId, seller, token, tokenId, price, expiresAt, sig);
    }

    function testRejectTamperedMetadata() public {
        bytes32 listingId = keccak256("listing-3");
        address token = address(0xBEEF);
        uint256 tokenId = 3;
        uint256 price = 1 ether;
        uint256 expiresAt = block.timestamp + 1 hours;

        bytes32 digest = registry.getListingDigest(listingId, seller, token, tokenId, price, expiresAt);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(uint256(uint160(seller)), digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.expectRevert();
        registry.createListing(listingId, seller, token, tokenId, price + 1, expiresAt, sig);
    }
}
