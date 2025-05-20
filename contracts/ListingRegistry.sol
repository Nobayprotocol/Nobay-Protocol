// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title ListingRegistry
/// @notice EIP-712 compatible registry for verifying off-chain signed listings
/// @dev Stores minimal metadata: seller, IPFS URI hash, signature verification

contract ListingRegistry is Ownable {
    using ECDSA for bytes32;

    struct Listing {
        address seller;
        string uri;         // IPFS or Arweave content hash
        uint256 timestamp;
        bool active;
    }

    mapping(uint256 => Listing) public listings;
    uint256 public listingCount;

    bytes32 public immutable DOMAIN_SEPARATOR;
    bytes32 public constant TYPEHASH = keccak256("Listing(address seller,string uri,uint256 timestamp)");

    event ListingVerified(uint256 indexed listingId, address indexed seller, string uri, uint256 timestamp);
    event ListingRevoked(uint256 indexed listingId, address indexed seller, uint256 timestamp);

    constructor() {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("Nobay Listing")),
                chainId,
                address(this)
            )
        );
    }

    /// @notice Submit a signed listing (EIP-712) to be verified on-chain
    /// @param seller The listing creator (signer)
    /// @param uri Off-chain metadata hash
    /// @param timestamp Timestamp used in signed payload
    /// @param signature EIP-712 compliant signature from seller
    function submitListingWithSig(
        address seller,
        string calldata uri,
        uint256 timestamp,
        bytes calldata signature
    ) external returns (uint256) {
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(TYPEHASH, seller, keccak256(bytes(uri)), timestamp))
            )
        );

        address recovered = digest.recover(signature);
        require(recovered == seller, "Invalid signature");

        listings[listingCount] = Listing({
            seller: seller,
            uri: uri,
            timestamp: timestamp,
            active: true
        });

        emit ListingVerified(listingCount, seller, uri, timestamp);
        return listingCount++;
    }

    /// @notice Deactivate a listing (seller only)
    function revokeListing(uint256 listingId) external {
        Listing storage l = listings[listingId];
        require(msg.sender == l.seller, "Not your listing");
        require(l.active, "Already inactive");
        l.active = false;
        emit ListingRevoked(listingId, msg.sender, block.timestamp);
    }

    /// @notice Admin emergency deactivation (DAO override)
    function forceRevoke(uint256 listingId) external onlyOwner {
        listings[listingId].active = false;
        emit ListingRevoked(listingId, listings[listingId].seller, block.timestamp);
    }
}
