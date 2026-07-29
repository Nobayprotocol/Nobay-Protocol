// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./StakingModule.sol";

/// @title SlashingModule
/// @notice DAO-compatible slashing for $NOBAY stakers
/// @dev Integrates with StakingModule to slash stakers for fraud / disputes.
///      Emits Slashed events and supports trust decay over time (bonus feature).
contract SlashingModule is Ownable {
    StakingModule public immutable staking;

    struct SlashRecord {
        address staker;
        uint256 amount;
        bytes32 reason;
        uint256 timestamp;
    }

    /// @notice Period after a slash during which trust is fully penalized (seconds)
    uint256 public trustDecayPeriod = 30 days;

    /// @notice Basis-point recovery rate per day after decay period (100 = 1% per day)
    uint256 public trustRecoveryRate = 100; // 1% / day

    SlashRecord[] public slashHistory;

    /// @notice Total amount slashed per staker
    mapping(address => uint256) public totalSlashed;

    /// @notice Timestamp of the most recent slash for a staker
    mapping(address => uint256) public lastSlashTimestamp;

    event Slashed(address indexed staker, uint256 amount, bytes32 indexed reason, uint256 timestamp);
    event TrustDecayConfigured(uint256 decayPeriod, uint256 recoveryRate);

    constructor(address _staking) {
        require(_staking != address(0), "SlashingModule: invalid staking address");
        staking = StakingModule(_staking);
    }

    /// @notice Slash a staker's active stake
    /// @param staker  Address being slashed
    /// @param amount  Amount of $NOBAY to remove
    /// @param reason  keccak256 reason e.g. keccak256("FRAUD")
    function slash(address staker, uint256 amount, bytes32 reason) external onlyOwner {
        require(staker != address(0), "SlashingModule: invalid staker");
        require(amount > 0, "SlashingModule: cannot slash zero");
        (uint256 stakedAmount, , bool isActive) = staking.stakes(staker);
        require(isActive, "SlashingModule: no active stake");
        require(stakedAmount >= amount, "SlashingModule: insufficient stake");

        slashHistory.push(SlashRecord({
            staker: staker,
            amount: amount,
            reason: reason,
            timestamp: block.timestamp
        }));

        totalSlashed[staker] += amount;
        lastSlashTimestamp[staker] = block.timestamp;

        staking.slashStaker(staker, amount);

        emit Slashed(staker, amount, reason, block.timestamp);
    }

    /// @notice Get effective stake considering trust decay / recovery over time
    /// @param seller  Address to query
    /// @return Effective stake amount after applying trust decay
    function getEffectiveStake(address seller) public view returns (uint256) {
        (uint256 staked, , ) = staking.stakes(seller);
        uint256 slashed = totalSlashed[seller];

        if (slashed == 0) return staked;

        uint256 timeSinceLastSlash = block.timestamp - lastSlashTimestamp[seller];

        // Within decay period → linear penalty proportional to recency
        if (timeSinceLastSlash < trustDecayPeriod) {
            uint256 penalty = slashed * (trustDecayPeriod - timeSinceLastSlash) / trustDecayPeriod;
            return staked >= penalty ? staked - penalty : 0;
        }

        // After decay period → trust gradually recovers
        uint256 recoveryTime = timeSinceLastSlash - trustDecayPeriod;
        uint256 recovered = (slashed * trustRecoveryRate * recoveryTime) / (10000 * 1 days);
        uint256 remainingSlash = slashed >= recovered ? slashed - recovered : 0;

        return staked >= remainingSlash ? staked - remainingSlash : 0;
    }

    /// @notice Number of recorded slash events
    function slashCount() external view returns (uint256) {
        return slashHistory.length;
    }

    /// @notice Configure trust decay parameters
    function configureTrustDecay(uint256 _decayPeriod, uint256 _recoveryRate) external onlyOwner {
        trustDecayPeriod = _decayPeriod;
        trustRecoveryRate = _recoveryRate;
        emit TrustDecayConfigured(_decayPeriod, _recoveryRate);
    }
}
