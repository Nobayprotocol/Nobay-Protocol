// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IStakingModule {
    function slash(
        address seller,
        uint256 amount,
        address recipient,
        string calldata reason
    ) external;

    function stakedBalance(address seller) external view returns (uint256);
}

/// @title SlashingModule
/// @notice DAO and dispute-resolution gateway for slashing seller stake
/// @dev The DAO address can be a multisig, governor executor, or timelock.
contract SlashingModule is Ownable {
    uint256 public constant MAX_TRUST_SCORE = 10_000;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    IStakingModule public immutable stakingModule;

    address public dao;
    address public slashRecipient;
    uint256 public slashPenaltyBps = 1_000;
    uint256 public trustDecayPerDay = 25;

    struct TrustState {
        uint256 score;
        uint256 updatedAt;
    }

    mapping(address => bool) public disputeResolvers;
    mapping(uint256 => bool) public resolvedDisputes;
    mapping(address => TrustState) private trustStates;

    event Slashed(address indexed seller, uint256 amount, string reason);
    event DaoUpdated(address indexed dao);
    event DisputeResolverUpdated(address indexed resolver, bool allowed);
    event SlashRecipientUpdated(address indexed recipient);
    event SlashPenaltyUpdated(uint256 penaltyBps);
    event TrustDecayUpdated(uint256 decayPerDay);
    event TrustScoreUpdated(address indexed seller, uint256 score, uint256 timestamp);

    constructor(address _stakingModule, address _dao, address _slashRecipient) {
        require(_stakingModule != address(0), "Invalid staking module");
        require(_dao != address(0), "Invalid DAO");
        require(_slashRecipient != address(0), "Invalid recipient");

        stakingModule = IStakingModule(_stakingModule);
        dao = _dao;
        slashRecipient = _slashRecipient;
    }

    modifier onlyDAO() {
        require(msg.sender == dao, "Only DAO");
        _;
    }

    modifier onlyDisputeResolver() {
        require(disputeResolvers[msg.sender], "Only dispute resolver");
        _;
    }

    /// @notice Slash after a DAO vote has passed and executed through the configured DAO address
    function slashByDAO(
        address seller,
        uint256 amount,
        string calldata reason
    ) external onlyDAO {
        _slash(seller, amount, reason);
    }

    /// @notice Slash after an approved dispute resolver decides against a seller
    function slashByDispute(
        uint256 disputeId,
        address seller,
        uint256 amount,
        string calldata reason
    ) external onlyDisputeResolver {
        require(!resolvedDisputes[disputeId], "Dispute already resolved");
        resolvedDisputes[disputeId] = true;

        _slash(seller, amount, reason);
    }

    /// @notice Returns the seller trust score after applying elapsed time decay
    function trustScore(address seller) public view returns (uint256) {
        TrustState memory state = trustStates[seller];
        if (state.updatedAt == 0) {
            return MAX_TRUST_SCORE;
        }

        uint256 elapsedDays = (block.timestamp - state.updatedAt) / 1 days;
        uint256 decay = elapsedDays * trustDecayPerDay;

        if (decay >= state.score) {
            return 0;
        }

        return state.score - decay;
    }

    /// @notice Checkpoints a seller's decayed trust score for indexers and external callers
    function applyTrustDecay(address seller) external returns (uint256) {
        return _checkpointTrust(seller);
    }

    /// @notice Returns raw checkpoint data before applying additional elapsed decay
    function trustState(address seller) external view returns (uint256 score, uint256 updatedAt) {
        TrustState memory state = trustStates[seller];
        return (state.score, state.updatedAt);
    }

    function setDAO(address _dao) external onlyOwner {
        require(_dao != address(0), "Invalid DAO");
        dao = _dao;
        emit DaoUpdated(_dao);
    }

    function setDisputeResolver(address resolver, bool allowed) external onlyOwner {
        require(resolver != address(0), "Invalid resolver");
        disputeResolvers[resolver] = allowed;
        emit DisputeResolverUpdated(resolver, allowed);
    }

    function setSlashRecipient(address recipient) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        slashRecipient = recipient;
        emit SlashRecipientUpdated(recipient);
    }

    function setSlashPenaltyBps(uint256 penaltyBps) external onlyOwner {
        require(penaltyBps <= BPS_DENOMINATOR, "Penalty too high");
        slashPenaltyBps = penaltyBps;
        emit SlashPenaltyUpdated(penaltyBps);
    }

    function setTrustDecayPerDay(uint256 decayPerDay) external onlyOwner {
        require(decayPerDay <= MAX_TRUST_SCORE, "Decay too high");
        trustDecayPerDay = decayPerDay;
        emit TrustDecayUpdated(decayPerDay);
    }

    function _slash(address seller, uint256 amount, string calldata reason) internal {
        require(seller != address(0), "Invalid seller");
        require(amount > 0, "Cannot slash zero");
        require(stakingModule.stakedBalance(seller) >= amount, "Insufficient stake");

        uint256 currentScore = trustScore(seller);
        uint256 penalty = (currentScore * slashPenaltyBps) / BPS_DENOMINATOR;
        uint256 nextScore = currentScore > penalty ? currentScore - penalty : 0;

        trustStates[seller] = TrustState({
            score: nextScore,
            updatedAt: block.timestamp
        });

        stakingModule.slash(seller, amount, slashRecipient, reason);

        emit Slashed(seller, amount, reason);
        emit TrustScoreUpdated(seller, nextScore, block.timestamp);
    }

    function _checkpointTrust(address seller) internal returns (uint256) {
        uint256 decayedScore = trustScore(seller);
        trustStates[seller] = TrustState({
            score: decayedScore,
            updatedAt: block.timestamp
        });

        emit TrustScoreUpdated(seller, decayedScore, block.timestamp);
        return decayedScore;
    }
}
