// contracts/ListingRegistry.sol
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract ListingRegistry {
    mapping(address => bool) public sellers;
    mapping(uint256 => string) public listingMetadata;

    function isValidSignature(bytes32 hash, bytes memory signature) public view returns (bool) {
        address signer = ECDSA.recover(hash, signature);
        return sellers[signer];
    }

    function addSeller(address seller) public {
        sellers[seller] = true;
    }

    function createListing(uint256 listingId, string memory metadata, bytes memory signature) public {
        require(isValidSignature(keccak256(abi.encodePacked(listingId, metadata)), signature), "Invalid signature");
        listingMetadata[listingId] = metadata;
    }
}