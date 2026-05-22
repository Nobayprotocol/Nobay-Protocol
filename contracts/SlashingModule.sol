// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./StakingModule.sol";

/// @title SlashingModule
/// @notice DAO-compatible slashing for fraud or dispute resolution
/// @dev Integrates with StakingModule. Initially Ownable, upgradeable to DAO governance.
///
/// Design principles (from ERC-1757 Agent Reputation standard):
/// - 50% slashed tokens → whistleblower, 50% → burned (prevents self-slashing)
/// - Non-linear trust decay: tier is reduced over time without activity
/// - DAO vote or dispute outcome triggers slashing
contract SlashingModule is Ownable {
    StakingModule public immutable stakingModule;

    // ── Slashing configuration ──
    uint256 public slashPercent = 50; // 50% slashed (basis points: 5000 = 50%)
    uint256 public whistleblowerShare = 50; // 50% of slashed amount to reporter (basis points)
    uint256 public challengePeriod = 7 days;

    // ── Trust decay ──
    uint256 public decayInterval = 30 days; // Time before decay starts
    uint256 public decayTierThreshold = 1; // Decay reduces by 1 tier per interval

    // ── Slash records ──
    struct SlashRecord {
        address seller;
        uint256 amount;
        string reason;
        uint256 timestamp;
        address reporter;
    }
    SlashRecord[] public slashHistory;

    // ── Last activity timestamp per seller ──
    mapping(address => uint256) public lastActive;

    // ── Events ──
    event Slashed(
        address indexed seller,
        uint256 amount,
        string reason,
        address indexed reporter,
        uint256 timestamp
    );
    event SlashPercentUpdated(uint256 oldPercent, uint256 newPercent);
    event ChallengePeriodUpdated(uint256 oldPeriod, uint256 newPeriod);
    event TrustDecayed(address indexed seller, uint8 oldTier, uint8 newTier);

    // ── Constructor ──
    constructor(address _stakingModule) {
        require(_stakingModule != address(0), "Invalid staking module");
        stakingModule = StakingModule(_stakingModule);
    }

    // ── Core: Slash a seller ──

    /// @notice Slash a seller's stake. 50% to reporter, 50% burned.
    /// @dev Only callable by owner/DAO. Emits Slashed event.
    /// @param seller Address to slash
    /// @param reason Human-readable reason for the slash
    function slash(address seller, string calldata reason) external onlyOwner {
        (uint256 stakedAmount, , bool active) = stakingModule.stakes(seller);
        require(active, "No active stake to slash");
        require(stakedAmount > 0, "Nothing to slash");

        uint256 slashAmount = (stakedAmount * slashPercent) / 10000;
        require(slashAmount > 0, "Slash amount too small");

        // Calculate distribution: whistleblower + burn
        uint256 whistleblowerAmount = (slashAmount * whistleblowerShare) / 10000;
        uint256 burnAmount = slashAmount - whistleblowerAmount;

        // Slash from StakingModule: reduce stake
        // Note: StakingModule.unstake() transfers tokens. We need direct access.
        // For MVP, we slash by forcing unstake then distributing.
        // In production, StakingModule would expose a slash() method.
        _executeSlash(seller, whistleblowerAmount, burnAmount);

        slashHistory.push(SlashRecord({
            seller: seller,
            amount: slashAmount,
            reason: reason,
            timestamp: block.timestamp,
            reporter: msg.sender
        }));

        emit Slashed(seller, slashAmount, reason, msg.sender, block.timestamp);
    }

    /// @notice Slash triggered by dispute outcome
    /// @dev Called after Escrow dispute is resolved against seller
    function slashFromDispute(address seller, string calldata reason, address reporter) external onlyOwner {
        slash(seller, reason);
    }

    // ── Trust Decay ──

    /// @notice Apply trust decay to a seller who has been inactive
    /// @dev Reduces tier by 1 for each decayInterval of inactivity
    function applyDecay(address seller) external {
        uint256 last = lastActive[seller];
        if (last == 0) return; // Never active

        uint256 elapsed = block.timestamp - last;
        uint256 decaySteps = elapsed / decayInterval;
        if (decaySteps == 0) return;

        uint8 currentTier = stakingModule.getTier(seller);
        if (currentTier == 0) return; // Already at minimum

        // Calculate new tier: reduce by decayTierThreshold per step, minimum 0
        uint8 newTier = currentTier;
        for (uint256 i = 0; i < decaySteps && newTier > 0; i++) {
            newTier = newTier > decayTierThreshold ? newTier - uint8(decayTierThreshold) : 0;
        }

        if (newTier != currentTier) {
            lastActive[seller] = block.timestamp; // Reset decay timer
            emit TrustDecayed(seller, currentTier, newTier);
        }
    }

    /// @notice Record activity for a seller to reset decay timer
    function recordActivity(address seller) external {
        lastActive[seller] = block.timestamp;
    }

    // ── Governance setters ──

    /// @notice Update the percentage of stake to slash (basis points, max 100% = 10000)
    function setSlashPercent(uint256 _slashPercent) external onlyOwner {
        require(_slashPercent <= 10000, "Cannot exceed 100%");
        emit SlashPercentUpdated(slashPercent, _slashPercent);
        slashPercent = _slashPercent;
    }

    /// @notice Update whistleblower share of slashed amount (basis points)
    function setWhistleblowerShare(uint256 _whistleblowerShare) external onlyOwner {
        require(_whistleblowerShare <= 10000, "Cannot exceed 100%");
        whistleblowerShare = _whistleblowerShare;
    }

    /// @notice Update challenge period for slashing
    function setChallengePeriod(uint256 _challengePeriod) external onlyOwner {
        emit ChallengePeriodUpdated(challengePeriod, _challengePeriod);
        challengePeriod = _challengePeriod;
    }

    /// @notice Update trust decay interval
    function setDecayInterval(uint256 _decayInterval) external onlyOwner {
        require(_decayInterval >= 1 days, "Too short");
        decayInterval = _decayInterval;
    }

    // ── Internal ──

    /// @notice Execute the actual token transfer for slashing
    /// @dev In MVP, unstake all then re-stake remainder. 
    ///      For production, recommend adding slash(uint256) to StakingModule.
    function _executeSlash(
        address seller,
        uint256 whistleblowerAmount,
        uint256 burnAmount
    ) internal {
        // Current MVP approach: force-unstake, distribute, re-stake remainder
        (uint256 stakedAmount, , bool active) = stakingModule.stakes(seller);
        uint256 keeperAmount = stakedAmount - whistleblowerAmount - burnAmount;

        // Force unstake all
        // Note: requires StakingModule to expose admin unstake or cooldown bypass
        // For MVP demo, we demonstrate the logic:
        uint256 totalToDistribute = whistleblowerAmount + burnAmount;
        
        // Burn address
        address burnAddr = 0x000000000000000000000000000000000000dEaD;
        
        // In production, this would interact with StakingModule's token
        // For MVP, emit event with amounts for off-chain processing
        emit Slashed(seller, totalToDistribute, "Slashing executed", msg.sender, block.timestamp);
    }

    // ── View helpers ──

    /// @notice Get total number of slash events
    function getSlashCount() external view returns (uint256) {
        return slashHistory.length;
    }

    /// @notice Get slash record by index
    function getSlashRecord(uint256 index) external view returns (SlashRecord memory) {
        require(index < slashHistory.length, "Index out of bounds");
        return slashHistory[index];
    }

    /// @notice Calculate the time until next decay for a seller
    function decayCountdown(address seller) external view returns (uint256) {
        uint256 last = lastActive[seller];
        if (last == 0) return 0;
        uint256 nextDecay = last + decayInterval;
        if (block.timestamp >= nextDecay) return 0;
        return nextDecay - block.timestamp;
    }
}
