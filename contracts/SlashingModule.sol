// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./IStakingModule.sol";
import "./ISlashingModule.sol";

/// @title SlashingModule
/// @notice DAO-compatible slashing module for $NOBAY stakers
/// @dev Supports slashing via DAO vote, dispute outcomes, and direct authorized slashers.
///      Includes trust decay and recovery calculation over time.
contract SlashingModule is ISlashingModule, Ownable, ReentrancyGuard {
    IStakingModule public immutable stakingModule;

    address public dao;
    address public treasury;

    uint256 public constant MAX_TRUST_SCORE = 10_000; // 100.00%
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant VOTE_DURATION = 3 days;
    uint256 public constant EXECUTION_DELAY = 1 days;

    /// @notice Period after a slash during which trust penalty remains in full effect (default: 30 days)
    uint256 public trustDecayPeriod = 30 days;

    /// @notice Recovery rate in basis points per day after decay period has elapsed (default: 100 bps = 1%/day)
    uint256 public trustRecoveryRateBps = 100;

    /// @notice Proposal count for on-chain DAO slash voting
    uint256 public proposalCount;

    /// @notice List of all slash records
    SlashRecord[] public slashHistory;

    /// @notice Authorized dispute resolvers / arbitration courts
    mapping(address => bool) public disputeResolvers;

    /// @notice Track processed disputes to prevent duplicate slashing
    mapping(uint256 => bool) public disputeProcessed;

    /// @notice Total tokens slashed per staker
    mapping(address => uint256) public totalSlashed;

    /// @notice Count of slashes per staker
    mapping(address => uint256) public slashCount;

    /// @notice Timestamp of the most recent slash for a staker
    mapping(address => uint256) public lastSlashTimestamp;

    /// @notice Last recorded base trust score for staker (0 means uninitialized or 0 score)
    mapping(address => uint256) public baseTrustScore;

    /// @notice Timestamp when staker's trust score was last recorded/checkpointed
    mapping(address => uint256) public lastTrustUpdate;

    /// @notice Tracks whether a staker has ever had a trust score initialized or modified
    mapping(address => bool) public trustInitialized;

    /// @notice On-chain DAO slash proposals
    mapping(uint256 => SlashProposal) public proposals;

    /// @notice Voting tracker: proposalId => voter => hasVoted
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    modifier onlyDAO() {
        require(msg.sender == dao || msg.sender == owner(), "SlashingModule: not authorized DAO");
        _;
    }

    modifier onlyDisputeResolver() {
        require(disputeResolvers[msg.sender] || msg.sender == owner(), "SlashingModule: not authorized dispute resolver");
        _;
    }

    modifier onlyAuthorizedSlasher() {
        require(
            msg.sender == dao || disputeResolvers[msg.sender] || msg.sender == owner(),
            "SlashingModule: caller is not authorized to slash"
        );
        _;
    }

    constructor(address _stakingModule, address _dao, address _treasury) {
        require(_stakingModule != address(0), "SlashingModule: invalid staking module");
        require(_treasury != address(0), "SlashingModule: invalid treasury");

        stakingModule = IStakingModule(_stakingModule);
        dao = _dao != address(0) ? _dao : msg.sender;
        treasury = _treasury;

        emit DAOUpdated(dao);
        emit TreasuryUpdated(treasury);
    }

    // ─────────────────────────────────────────────
    // Admin / Configuration
    // ─────────────────────────────────────────────

    /// @notice Sets the DAO governance address
    /// @param _dao New DAO governance address
    function setDAO(address _dao) external onlyOwner {
        require(_dao != address(0), "SlashingModule: invalid DAO address");
        dao = _dao;
        emit DAOUpdated(_dao);
    }

    /// @notice Sets the recipient treasury address for slashed tokens
    /// @param _treasury New treasury address
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "SlashingModule: invalid treasury address");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    /// @notice Authorizes or deauthorizes a dispute resolver / arbitration court
    /// @param resolver Address of the dispute resolver
    /// @param status Authorization status
    function setDisputeResolver(address resolver, bool status) external onlyOwner {
        require(resolver != address(0), "SlashingModule: invalid resolver address");
        disputeResolvers[resolver] = status;
        emit DisputeResolverUpdated(resolver, status);
    }

    /// @notice Configures trust decay period and recovery rate parameters
    /// @param _decayPeriod Inactivity/lock duration before recovery begins (seconds)
    /// @param _recoveryRateBps Basis points recovered per day after decay period (e.g. 100 = 1%)
    function configureTrustDecay(uint256 _decayPeriod, uint256 _recoveryRateBps) external onlyOwner {
        require(_recoveryRateBps <= BPS_DENOMINATOR, "SlashingModule: invalid recovery rate");
        trustDecayPeriod = _decayPeriod;
        trustRecoveryRateBps = _recoveryRateBps;
        emit TrustDecayConfigured(_decayPeriod, _recoveryRateBps);
    }

    // ─────────────────────────────────────────────
    // Slashing Operations
    // ─────────────────────────────────────────────

    /// @notice Slash a staker's active stake (general authorized entrypoint)
    /// @param staker Address of the staker to slash
    /// @param amount Amount of $NOBAY tokens to slash
    /// @param reason Description / category of infraction
    function slash(address staker, uint256 amount, string calldata reason) external override onlyAuthorizedSlasher nonReentrant {
        _slash(staker, amount, reason, msg.sender);
    }

    /// @notice Slash a staker by DAO vote / direct DAO execution
    /// @param staker Address of the staker to slash
    /// @param amount Amount of $NOBAY tokens to slash
    /// @param reason Reason for the DAO slash
    function slashByDAO(address staker, uint256 amount, string calldata reason) external override onlyDAO nonReentrant {
        _slash(staker, amount, reason, msg.sender);
        emit SlashedByDAO(staker, amount, reason);
    }

    /// @notice Slash a staker following a dispute outcome / arbitration decision
    /// @param staker Address of the staker to slash
    /// @param disputeId Unique dispute identifier to prevent double-execution
    /// @param amount Amount of $NOBAY tokens to slash
    /// @param reason Reason for the dispute slash
    function slashByDispute(
        address staker,
        uint256 disputeId,
        uint256 amount,
        string calldata reason
    ) external override onlyDisputeResolver nonReentrant {
        require(!disputeProcessed[disputeId], "SlashingModule: dispute already processed");
        disputeProcessed[disputeId] = true;

        _slash(staker, amount, reason, msg.sender);
        emit SlashedByDispute(staker, disputeId, amount, reason);
    }

    /// @dev Internal execution of stake slash and trust score update
    function _slash(address staker, uint256 amount, string memory reason, address slasher) internal {
        require(staker != address(0), "SlashingModule: invalid staker");
        require(amount > 0, "SlashingModule: cannot slash zero amount");

        uint256 currentStaked = stakingModule.stakedBalance(staker);
        require(currentStaked > 0, "SlashingModule: no active stake");
        require(currentStaked >= amount, "SlashingModule: insufficient stake");

        // Calculate trust penalty
        uint256 currentScore = getTrustScore(staker);
        uint256 penalty = (amount * MAX_TRUST_SCORE) / currentStaked;
        uint256 newScore = currentScore > penalty ? currentScore - penalty : 0;

        baseTrustScore[staker] = newScore;
        trustInitialized[staker] = true;
        lastTrustUpdate[staker] = block.timestamp;
        lastSlashTimestamp[staker] = block.timestamp;

        totalSlashed[staker] += amount;
        slashCount[staker] += 1;

        slashHistory.push(SlashRecord({
            staker: staker,
            amount: amount,
            reason: reason,
            timestamp: block.timestamp,
            slasher: slasher
        }));

        // Execute slash on StakingModule
        stakingModule.slash(staker, amount, treasury, reason);

        // Required event emission per Issue #1
        emit Slashed(staker, amount, reason);
        emit TrustScoreUpdated(staker, newScore, block.timestamp);
    }

    // ─────────────────────────────────────────────
    // Trust Decay & Score Functions (Bonus)
    // ─────────────────────────────────────────────

    /// @notice Returns the current trust score of a staker taking decay and recovery into account
    /// @param staker Address of the staker
    /// @return Current trust score scaled to MAX_TRUST_SCORE (10,000 = 100.00%)
    function getTrustScore(address staker) public view override returns (uint256) {
        if (!trustInitialized[staker]) {
            // If never slashed, full trust if staked, 0 otherwise
            return stakingModule.stakedBalance(staker) > 0 ? MAX_TRUST_SCORE : 0;
        }

        uint256 base = baseTrustScore[staker];
        uint256 lastSlash = lastSlashTimestamp[staker];

        if (lastSlash == 0 || block.timestamp <= lastSlash + trustDecayPeriod) {
            return base;
        }

        // Trust gradually recovers after decay period has elapsed
        uint256 decayStartTime = lastSlash + trustDecayPeriod;
        uint256 effectiveStart = lastTrustUpdate[staker] > decayStartTime
            ? lastTrustUpdate[staker]
            : decayStartTime;

        if (block.timestamp <= effectiveStart) {
            return base;
        }

        uint256 recoveryDuration = block.timestamp - effectiveStart;
        uint256 recoveredPoints = (recoveryDuration * trustRecoveryRateBps * MAX_TRUST_SCORE) / (1 days * BPS_DENOMINATOR);

        uint256 currentScore = base + recoveredPoints;
        return currentScore > MAX_TRUST_SCORE ? MAX_TRUST_SCORE : currentScore;
    }

    /// @notice Calculates the effective stake based on trust score
    /// @param staker Address of the staker
    /// @return Effective stake amount adjusted for trust decay / penalties
    function getEffectiveStake(address staker) external view returns (uint256) {
        uint256 staked = stakingModule.stakedBalance(staker);
        if (staked == 0) return 0;
        uint256 score = getTrustScore(staker);
        return (staked * score) / MAX_TRUST_SCORE;
    }

    /// @notice Checkpoints and persists the decayed trust score on-chain
    /// @param staker Address of the staker
    /// @return The updated trust score
    function applyTrustDecay(address staker) external override returns (uint256) {
        uint256 score = getTrustScore(staker);
        baseTrustScore[staker] = score;
        trustInitialized[staker] = true;
        lastTrustUpdate[staker] = block.timestamp;

        emit TrustScoreUpdated(staker, score, block.timestamp);
        return score;
    }

    // ─────────────────────────────────────────────
    // DAO Proposal Voting Workflow
    // ─────────────────────────────────────────────

    /// @notice Propose a slash via DAO on-chain vote
    /// @param target Address of the staker to be slashed
    /// @param amount Amount to slash
    /// @param reason Categorical reason / proposal details
    /// @return proposalId Identifier of the created proposal
    function proposeSlash(
        address target,
        uint256 amount,
        string calldata reason
    ) external override returns (uint256 proposalId) {
        require(target != address(0), "SlashingModule: invalid target");
        require(amount > 0, "SlashingModule: cannot slash zero");
        require(stakingModule.stakedBalance(target) >= amount, "SlashingModule: insufficient stake");

        proposalId = ++proposalCount;

        proposals[proposalId] = SlashProposal({
            id: proposalId,
            target: target,
            amount: amount,
            reason: reason,
            proposer: msg.sender,
            votesFor: 0,
            votesAgainst: 0,
            createdAt: block.timestamp,
            votingEndsAt: block.timestamp + VOTE_DURATION,
            executionDelay: EXECUTION_DELAY,
            executed: false,
            canceled: false
        });

        emit SlashProposed(proposalId, msg.sender, target, amount, reason);
    }

    /// @notice Cast a vote on an active slash proposal
    /// @param proposalId ID of the proposal
    /// @param support True for YES (approve slash), false for NO
    function castVote(uint256 proposalId, bool support) external override {
        SlashProposal storage prop = proposals[proposalId];
        require(prop.id == proposalId && prop.id != 0, "SlashingModule: proposal not found");
        require(block.timestamp <= prop.votingEndsAt, "SlashingModule: voting closed");
        require(!prop.canceled, "SlashingModule: proposal canceled");
        require(!hasVoted[proposalId][msg.sender], "SlashingModule: already voted");

        uint256 weight = stakingModule.stakedBalance(msg.sender);
        require(weight > 0, "SlashingModule: no voting weight");

        hasVoted[proposalId][msg.sender] = true;

        if (support) {
            prop.votesFor += weight;
        } else {
            prop.votesAgainst += weight;
        }

        emit SlashVoteCast(proposalId, msg.sender, support, weight);
    }

    /// @notice Execute an approved slash proposal after voting and execution delay
    /// @param proposalId ID of the proposal to execute
    function executeSlashProposal(uint256 proposalId) external override nonReentrant {
        SlashProposal storage prop = proposals[proposalId];
        require(prop.id == proposalId && prop.id != 0, "SlashingModule: proposal not found");
        require(block.timestamp > prop.votingEndsAt, "SlashingModule: voting still active");
        require(
            block.timestamp >= prop.votingEndsAt + prop.executionDelay,
            "SlashingModule: execution delay not met"
        );
        require(!prop.executed, "SlashingModule: already executed");
        require(!prop.canceled, "SlashingModule: proposal canceled");
        require(prop.votesFor > prop.votesAgainst, "SlashingModule: proposal rejected");

        prop.executed = true;

        _slash(prop.target, prop.amount, prop.reason, address(this));

        emit SlashProposalExecuted(proposalId, prop.target, prop.amount);
    }

    /// @notice Cancel a pending slash proposal
    /// @param proposalId ID of the proposal
    /// @param cancelReason Reason for canceling
    function cancelProposal(uint256 proposalId, string calldata cancelReason) external {
        SlashProposal storage prop = proposals[proposalId];
        require(prop.id == proposalId && prop.id != 0, "SlashingModule: proposal not found");
        require(
            msg.sender == prop.proposer || msg.sender == dao || msg.sender == owner(),
            "SlashingModule: not authorized to cancel"
        );
        require(!prop.executed, "SlashingModule: already executed");
        require(!prop.canceled, "SlashingModule: already canceled");

        prop.canceled = true;

        emit SlashProposalCanceled(proposalId, cancelReason);
    }

    // ─────────────────────────────────────────────
    // View Utilities
    // ─────────────────────────────────────────────

    /// @notice Returns the total number of slash history records
    function slashHistoryLength() external view returns (uint256) {
        return slashHistory.length;
    }

    /// @notice Returns a slash record by index
    function getSlashRecord(uint256 index) external view returns (SlashRecord memory) {
        require(index < slashHistory.length, "SlashingModule: index out of bounds");
        return slashHistory[index];
    }
}
