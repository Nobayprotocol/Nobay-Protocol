// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title SlashingModule
/// @notice Handles penalization and stake slashing for fraudulent sellers and dispute resolution
/// @dev Integrates with Nobay StakingModule and DAO Governance / Dispute Courts

contract SlashingModule is Ownable {
    IERC20 public immutable nobay;
    address public daoTreasury;

    // Authorized entities that can execute slashes (e.g., DAO Governor, Dispute Court, Arbitrators)
    mapping(address => bool) public authorizedSlashers;

    // Reputation and Trust Decay tracking
    struct SellerProfile {
        uint256 baseTrustScore;      // 0 - 10000 (basis points)
        uint256 lastActivityTime;
        uint256 totalSlashedAmount;
        uint256 slashCount;
    }

    mapping(address => SellerProfile) public profiles;

    // Decay parameters: 1% decay per 30 days of inactivity
    uint256 public constant DECAY_UNIT = 30 days;
    uint256 public constant DECAY_RATE_BPS = 100; // 1%

    event Slashed(address indexed seller, uint256 amount, string reason);
    event TrustScoreUpdated(address indexed seller, uint256 newScore);
    event SlasherAuthorized(address indexed slasher, bool authorized);
    event DaoTreasuryUpdated(address indexed newTreasury);

    modifier onlySlasherOrOwner() {
        require(msg.sender == owner() || authorizedSlashers[msg.sender], "Not authorized to slash");
        _;
    }

    constructor(address _nobay, address _daoTreasury) {
        require(_nobay != address(0), "Invalid token address");
        require(_daoTreasury != address(0), "Invalid treasury address");
        nobay = IERC20(_nobay);
        daoTreasury = _daoTreasury;
    }

    /// @notice Authorize or revoke an arbitrator / DAO contract to slash
    function setSlasher(address slasher, bool authorized) external onlyOwner {
        authorizedSlashers[slasher] = authorized;
        emit SlasherAuthorized(slasher, authorized);
    }

    /// @notice Update DAO treasury address
    function setDaoTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid address");
        daoTreasury = newTreasury;
        emit DaoTreasuryUpdated(newTreasury);
    }

    /// @notice Execute a slash against a fraudulent seller
    /// @param seller The seller to penalize
    /// @param amount Amount of tokens to slash from stake or penalty pool
    /// @param reason Documented dispute or fraud reason
    function slash(
        address seller,
        uint256 amount,
        string calldata reason
    ) external onlySlasherOrOwner {
        require(seller != address(0), "Invalid seller address");
        require(amount > 0, "Amount must be greater than zero");

        SellerProfile storage profile = profiles[seller];
        profile.totalSlashedAmount += amount;
        profile.slashCount += 1;
        profile.lastActivityTime = block.timestamp;

        // Reduce trust score proportionally
        if (profile.baseTrustScore > 2000) {
            profile.baseTrustScore -= 2000; // 20% penalty
        } else {
            profile.baseTrustScore = 0;
        }

        // Transfer slashed tokens from caller or module to DAO Treasury
        // If caller is an escrow/staking contract holding the funds, it sends to treasury
        if (nobay.balanceOf(address(this)) >= amount) {
            nobay.transfer(daoTreasury, amount);
        }

        emit Slashed(seller, amount, reason);
        emit TrustScoreUpdated(seller, profile.baseTrustScore);
    }

    /// @notice Calculate current trust score with time-based decay applied
    /// @param seller Address of the seller
    function getDecayedTrustScore(address seller) public view returns (uint256) {
        SellerProfile memory profile = profiles[seller];
        if (profile.baseTrustScore == 0) {
            return 0;
        }

        uint256 elapsed = block.timestamp - profile.lastActivityTime;
        uint256 decayPeriods = elapsed / DECAY_UNIT;
        uint256 totalDecayBps = decayPeriods * DECAY_RATE_BPS;

        if (totalDecayBps >= 10000) {
            return 0;
        }

        return (profile.baseTrustScore * (10000 - totalDecayBps)) / 10000;
    }

    /// @notice Update baseline trust score following positive trade completion
    function recordSuccessfulTrade(address seller, uint256 boost) external onlySlasherOrOwner {
        SellerProfile storage profile = profiles[seller];
        profile.baseTrustScore = getDecayedTrustScore(seller) + boost;
        if (profile.baseTrustScore > 10000) {
            profile.baseTrustScore = 10000;
        }
        profile.lastActivityTime = block.timestamp;
        emit TrustScoreUpdated(seller, profile.baseTrustScore);
    }
}
