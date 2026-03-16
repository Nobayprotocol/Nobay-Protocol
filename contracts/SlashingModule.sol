// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title SlashingModule
/// @notice DAO-compatible slashing for $NOBAY stakers — fraud and dispute resolution
/// @dev Integrates with StakingModule to slash staked balances

interface IStakingModule {
    function stakes(address) external view returns (uint256 amount, uint256 timestamp, bool active);
}

contract SlashingModule is Ownable {
    // ── State ────────────────────────────────────────────

    IStakingModule public immutable stakingModule;
    IERC20 public immutable nobay;

    /// @notice Minimum DAO votes required to execute a slash
    uint256 public slashQuorum = 3;

    /// @notice Trust decay rate per day (basis points, 100 = 1%)
    uint256 public decayRateBps = 50; // 0.5% per day

    /// @notice Slash proposals
    struct SlashProposal {
        address target;
        uint256 amount;
        string reason;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 createdAt;
        uint256 executedAt;
        bool executed;
        bool cancelled;
    }

    uint256 public proposalCount;
    mapping(uint256 => SlashProposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    /// @notice Slash history per address
    mapping(address => uint256) public totalSlashed;
    mapping(address => uint256) public lastSlashedAt;

    // ── Events ───────────────────────────────────────────

    event SlashProposed(uint256 indexed proposalId, address indexed target, uint256 amount, string reason);
    event SlashVoted(uint256 indexed proposalId, address indexed voter, bool support);
    event Slashed(address indexed target, uint256 amount, string reason);
    event SlashCancelled(uint256 indexed proposalId);
    event TrustDecayed(address indexed target, uint256 decayAmount, uint256 daysElapsed);

    // ── Constructor ──────────────────────────────────────

    constructor(address _stakingModule, address _nobay) {
        stakingModule = IStakingModule(_stakingModule);
        nobay = IERC20(_nobay);
    }

    // ── Slash by DAO Vote ────────────────────────────────

    /// @notice Propose slashing a staker (callable by any staker)
    /// @param target Address to slash
    /// @param amount Amount of $NOBAY to slash
    /// @param reason Human-readable reason for the slash
    function proposeSlash(
        address target,
        uint256 amount,
        string calldata reason
    ) external returns (uint256) {
        (uint256 stakedAmount, , bool active) = stakingModule.stakes(target);
        require(active, "Target has no active stake");
        require(amount > 0 && amount <= stakedAmount, "Invalid slash amount");

        // Proposer must also be a staker
        (, , bool proposerActive) = stakingModule.stakes(msg.sender);
        require(proposerActive, "Only stakers can propose");

        proposals[proposalCount] = SlashProposal({
            target: target,
            amount: amount,
            reason: reason,
            votesFor: 1, // proposer auto-votes for
            votesAgainst: 0,
            createdAt: block.timestamp,
            executedAt: 0,
            executed: false,
            cancelled: false
        });
        hasVoted[proposalCount][msg.sender] = true;

        emit SlashProposed(proposalCount, target, amount, reason);
        return proposalCount++;
    }

    /// @notice Vote on a slash proposal
    /// @param proposalId ID of the proposal
    /// @param support True = vote to slash, False = vote against
    function voteSlash(uint256 proposalId, bool support) external {
        SlashProposal storage p = proposals[proposalId];
        require(!p.executed, "Already executed");
        require(!p.cancelled, "Cancelled");
        require(!hasVoted[proposalId][msg.sender], "Already voted");

        // Voter must be a staker
        (, , bool active) = stakingModule.stakes(msg.sender);
        require(active, "Only stakers can vote");

        hasVoted[proposalId][msg.sender] = true;

        if (support) {
            p.votesFor++;
        } else {
            p.votesAgainst++;
        }

        emit SlashVoted(proposalId, msg.sender, support);
    }

    /// @notice Execute a slash after quorum is reached
    /// @param proposalId ID of the proposal to execute
    function executeSlash(uint256 proposalId) external {
        SlashProposal storage p = proposals[proposalId];
        require(!p.executed, "Already executed");
        require(!p.cancelled, "Cancelled");
        require(p.votesFor >= slashQuorum, "Quorum not reached");
        require(p.votesFor > p.votesAgainst, "Majority not in favor");

        p.executed = true;
        p.executedAt = block.timestamp;

        totalSlashed[p.target] += p.amount;
        lastSlashedAt[p.target] = block.timestamp;

        // Transfer slashed tokens to the contract (burned or redistributed by DAO)
        // Note: In production, the StakingModule would need a slash() function
        // that this contract can call. For now, we record the slash.
        emit Slashed(p.target, p.amount, p.reason);
    }

    /// @notice Cancel a slash proposal (owner/DAO only)
    function cancelSlash(uint256 proposalId) external onlyOwner {
        SlashProposal storage p = proposals[proposalId];
        require(!p.executed, "Already executed");
        p.cancelled = true;
        emit SlashCancelled(proposalId);
    }

    // ── Slash by Dispute Outcome ─────────────────────────

    /// @notice Direct slash from dispute resolution (owner/DAO only)
    /// @param target Address to slash
    /// @param amount Amount to slash
    /// @param reason Dispute reference
    function slashByDispute(
        address target,
        uint256 amount,
        string calldata reason
    ) external onlyOwner {
        (uint256 stakedAmount, , bool active) = stakingModule.stakes(target);
        require(active, "Target has no active stake");
        require(amount > 0 && amount <= stakedAmount, "Invalid slash amount");

        totalSlashed[target] += amount;
        lastSlashedAt[target] = block.timestamp;

        emit Slashed(target, amount, reason);
    }

    // ── Trust Decay ──────────────────────────────────────

    /// @notice Calculate trust decay for an address based on time since last activity
    /// @param target Address to calculate decay for
    /// @return decayAmount The amount of trust points decayed
    function calculateDecay(address target) public view returns (uint256 decayAmount) {
        (uint256 stakedAmount, uint256 stakeTimestamp, bool active) = stakingModule.stakes(target);
        if (!active || stakedAmount == 0) return 0;

        uint256 daysSinceStake = (block.timestamp - stakeTimestamp) / 1 days;
        if (daysSinceStake == 0) return 0;

        // Decay = stakedAmount * decayRate * days / 10000
        decayAmount = (stakedAmount * decayRateBps * daysSinceStake) / 10000;
        if (decayAmount > stakedAmount) decayAmount = stakedAmount;
    }

    /// @notice Apply trust decay (callable by anyone — incentivized by DAO)
    function applyDecay(address target) external {
        uint256 decay = calculateDecay(target);
        require(decay > 0, "No decay to apply");

        totalSlashed[target] += decay;
        lastSlashedAt[target] = block.timestamp;

        emit TrustDecayed(target, decay, (block.timestamp - lastSlashedAt[target]) / 1 days);
    }

    // ── View Functions ───────────────────────────────────

    /// @notice Get effective stake after slashing
    function effectiveStake(address target) external view returns (uint256) {
        (uint256 stakedAmount, , ) = stakingModule.stakes(target);
        uint256 slashed = totalSlashed[target];
        return stakedAmount > slashed ? stakedAmount - slashed : 0;
    }

    /// @notice Get proposal details
    function getProposal(uint256 proposalId) external view returns (
        address target, uint256 amount, string memory reason,
        uint256 votesFor, uint256 votesAgainst, bool executed, bool cancelled
    ) {
        SlashProposal storage p = proposals[proposalId];
        return (p.target, p.amount, p.reason, p.votesFor, p.votesAgainst, p.executed, p.cancelled);
    }

    // ── Admin ────────────────────────────────────────────

    /// @notice Update slash quorum (DAO governance)
    function setQuorum(uint256 newQuorum) external onlyOwner {
        require(newQuorum > 0, "Quorum must be > 0");
        slashQuorum = newQuorum;
    }

    /// @notice Update decay rate (DAO governance)
    function setDecayRate(uint256 newRateBps) external onlyOwner {
        require(newRateBps <= 1000, "Max 10% per day");
        decayRateBps = newRateBps;
    }
}
