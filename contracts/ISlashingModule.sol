// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ISlashingModule
/// @notice Interface for DAO-compatible Slashing Module
interface ISlashingModule {
    enum ProposalState {
        Pending,
        Approved,
        Rejected,
        Executed,
        Canceled
    }

    struct SlashProposal {
        uint256 id;
        address target;
        uint256 amount;
        string reason;
        address proposer;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 createdAt;
        uint256 votingEndsAt;
        uint256 executionDelay;
        bool executed;
        bool canceled;
    }

    struct SlashRecord {
        address staker;
        uint256 amount;
        string reason;
        uint256 timestamp;
        address slasher;
    }

    // Required by Issue #1
    event Slashed(address indexed staker, uint256 amount, string reason);

    // Extended event emissions
    event SlashedByDAO(address indexed staker, uint256 amount, string reason);
    event SlashedByDispute(address indexed staker, uint256 indexed disputeId, uint256 amount, string reason);
    event SlashProposed(uint256 indexed proposalId, address indexed proposer, address indexed target, uint256 amount, string reason);
    event SlashVoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight);
    event SlashProposalExecuted(uint256 indexed proposalId, address indexed target, uint256 amount);
    event SlashProposalCanceled(uint256 indexed proposalId, string reason);
    event TrustScoreUpdated(address indexed staker, uint256 newScore, uint256 timestamp);
    event TrustDecayConfigured(uint256 decayPeriod, uint256 recoveryRateBps);
    event DisputeResolverUpdated(address indexed resolver, bool status);
    event TreasuryUpdated(address indexed treasury);
    event DAOUpdated(address indexed dao);

    function slash(address staker, uint256 amount, string calldata reason) external;
    function slashByDAO(address staker, uint256 amount, string calldata reason) external;
    function slashByDispute(address staker, uint256 disputeId, uint256 amount, string calldata reason) external;
    function proposeSlash(address target, uint256 amount, string calldata reason) external returns (uint256);
    function castVote(uint256 proposalId, bool support) external;
    function executeSlashProposal(uint256 proposalId) external;
    function getTrustScore(address staker) external view returns (uint256);
    function applyTrustDecay(address staker) external returns (uint256);
}
