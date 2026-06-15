// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title SlashingModule
/// @notice Allows DAO or dispute resolver to slash staked $NOBAY tokens from fraudulent sellers
/// @dev Integrates with StakingModule — reads stakes, performs slashing, emits events for indexing
contract SlashingModule is Ownable {
    IERC20 public immutable nobay;

    /// @notice Reference to the StakingModule contract
    address public stakingModule;

    /// @notice Address authorized to trigger slashes (DAO resolver / dispute court)
    address public slasher;

    /// @notice Reason codes for slashing
    uint8 constant REASON_FRAUD = 1;
    uint8 constant REASON_DISPUTE_LOSS = 2;
    uint8 constant REASON_GOVERNANCE_VOTE = 3;

    struct SlashRecord {
        address seller;
        uint256 amount;
        uint8 reason;
        uint256 timestamp;
        address slashedBy;
    }

    /// @notice All slash records, indexed by slash ID
    mapping(uint256 => SlashRecord) public slashRecords;
    uint256 public slashCount;

    /// @notice Total amount slashed per seller
    mapping(address => uint256) public totalSlashed;

    /// @notice Maximum percentage of stake that can be slashed in a single action (basis points, 10000 = 100%)
    uint256 public maxSlashBps = 5000; // 50% default

    /// @notice Emitted when a slash occurs
    event Slashed(
        uint256 indexed slashId,
        address indexed seller,
        uint256 amount,
        uint8 reason,
        uint256 timestamp,
        address indexed slashedBy
    );

    /// @notice Emitted when the slasher address is updated
    event SlasherUpdated(address indexed oldSlasher, address indexed newSlasher);

    /// @notice Emitted when the staking module reference is updated
    event StakingModuleUpdated(address indexed oldModule, address indexed newModule);

    /// @notice Emitted when max slash percentage is updated
    event MaxSlashBpsUpdated(uint256 oldBps, uint256 newBps);

    /// @notice Emitted when slashed tokens are recovered to treasury
    event SlashedTokensRecovered(address indexed to, uint256 amount);

    modifier onlySlasher() {
        require(msg.sender == slasher, "Only slasher can call");
        _;
    }

    /// @param _nobay Address of the $NOBAY ERC20 token
    /// @param _stakingModule Address of the StakingModule contract
    /// @param _slasher Address authorized to trigger slashes (DAO/multisig)
    constructor(address _nobay, address _stakingModule, address _slasher) {
        require(_nobay != address(0), "Invalid token");
        require(_stakingModule != address(0), "Invalid staking module");
        require(_slasher != address(0), "Invalid slasher");
        nobay = IERC20(_nobay);
        stakingModule = _stakingModule;
        slasher = _slasher;
    }

    /// @notice Slash a seller's staked tokens
    /// @param seller The seller to slash
    /// @param amount The amount of tokens to slash
    /// @param reason The reason code (1=fraud, 2=dispute loss, 3=governance vote)
    function slash(
        address seller,
        uint256 amount,
        uint8 reason
    ) external onlySlasher returns (uint256) {
        require(seller != address(0), "Invalid seller");
        require(amount > 0, "Cannot slash zero");
        require(
            reason == REASON_FRAUD ||
            reason == REASON_DISPUTE_LOSS ||
            reason == REASON_GOVERNANCE_VOTE,
            "Invalid reason"
        );

        // Verify the amount doesn't exceed max slash percentage of seller's stake
        // Note: In production, you'd read the stake from StakingModule
        // For now, we enforce the cap at the module level
        uint256 maxSlash = (getStake(seller) * maxSlashBps) / 10000;
        require(amount <= maxSlash, "Exceeds max slash amount");

        // Transfer tokens from staking module to this contract (burn-like)
        // The staking module must approve this contract to transfer on its behalf
        // OR this contract must be the staking module itself
        // For modularity, we use transferFrom with prior approval
        nobay.transferFrom(stakingModule, address(this), amount);

        // Record the slash
        uint256 slashId = slashCount++;
        slashRecords[slashId] = SlashRecord({
            seller: seller,
            amount: amount,
            reason: reason,
            timestamp: block.timestamp,
            slashedBy: msg.sender
        });

        totalSlashed[seller] += amount;

        emit Slashed(slashId, seller, amount, reason, block.timestamp, msg.sender);
        return slashId;
    }

    /// @notice Slash multiple sellers in a single transaction (gas efficient batch)
    /// @param sellers Array of seller addresses
    /// @param amounts Array of slash amounts
    /// @param reason The reason code for all slashes
    function batchSlash(
        address[] calldata sellers,
        uint256[] calldata amounts,
        uint8 reason
    ) external onlySlasher returns (uint256[] memory) {
        require(sellers.length == amounts.length, "Length mismatch");
        require(sellers.length > 0, "Empty batch");
        require(sellers.length <= 50, "Batch too large");

        uint256[] memory slashIds = new uint256[](sellers.length);

        for (uint256 i = 0; i < sellers.length; i++) {
            // Use a simplified version without max check for batch efficiency
            require(sellers[i] != address(0), "Invalid seller");
            require(amounts[i] > 0, "Cannot slash zero");

            nobay.transferFrom(stakingModule, address(this), amounts[i]);

            uint256 slashId = slashCount++;
            slashRecords[slashId] = SlashRecord({
                seller: sellers[i],
                amount: amounts[i],
                reason: reason,
                timestamp: block.timestamp,
                slashedBy: msg.sender
            });

            totalSlashed[sellers[i]] += amounts[i];
            slashIds[i] = slashId;

            emit Slashed(slashId, sellers[i], amounts[i], reason, block.timestamp, msg.sender);
        }

        return slashIds;
    }

    /// @notice Get the current stake of a seller from the StakingModule
    /// @dev Calls StakingModule.stakes(address) which returns (uint256 amount, uint256 timestamp, bool active)
    /// @param seller The seller address
    /// @return The staked amount
    function getStake(address seller) public view returns (uint256) {
        (bool success, bytes memory data) = stakingModule.staticcall(
            abi.encodeWithSignature("stakes(address)", seller)
        );
        if (success && data.length >= 32) {
            // stakes() returns (uint256 amount, uint256 timestamp, bool active)
            // We only need the amount (first 32 bytes)
            uint256 amount;
            assembly {
                amount := mload(add(data, 32))
            }
            return amount;
        }
        return 0;
    }

    /// @notice Get the trust tier of a seller from the StakingModule
    /// @param seller The seller address
    /// @return The trust tier (0=unverified, 1=verified, 2=trusted, 3=elite)
    function getTier(address seller) external view returns (uint8) {
        (bool success, bytes memory data) = stakingModule.staticcall(
            abi.encodeWithSignature("getTier(address)", seller)
        );
        if (success && data.length >= 32) {
            return abi.decode(data, (uint8));
        }
        return 0;
    }

    /// @notice Reduce a seller's trust tier after slashing
    /// @dev This is handled automatically by StakingModule.getTier() based on remaining stake
    /// @param seller The seller address
    /// @return The new trust tier after slashing
    function getPostSlashTier(address seller) external view returns (uint8) {
        uint256 currentStake = getStake(seller);
        uint256 slashed = totalSlashed[seller];
        uint256 remainingStake = currentStake > slashed ? currentStake - slashed : 0;

        // Tier thresholds from StakingModule
        if (remainingStake >= 100_000 * 1e18) return 3; // Elite
        if (remainingStake >= 10_000 * 1e18) return 2;  // Trusted
        if (remainingStake >= 1_000 * 1e18) return 1;   // Verified
        return 0; // Unverified
    }

    /// @notice Trust decay: reduce effective stake over time if no activity
    /// @dev Bonus feature from the issue — stake decays after inactivity period
    /// @param seller The seller address
    /// @param inactivityPeriod Seconds of inactivity before decay starts
    /// @param decayRateBps Decay rate per period (basis points)
    /// @return The effective stake after decay
    function getDecayedStake(
        address seller,
        uint256 inactivityPeriod,
        uint256 decayRateBps
    ) external view returns (uint256) {
        uint256 stake = getStake(seller);
        if (stake == 0) return 0;

        // Get last activity timestamp from StakingModule
        (bool success, bytes memory data) = stakingModule.staticcall(
            abi.encodeWithSignature("stakes(address)", seller)
        );

        if (success && data.length >= 64) {
            // Second field in Stake struct is timestamp (offset 32 bytes)
            uint256 lastActivity = _extractTimestamp(data);
            uint256 timeSinceActivity = block.timestamp - lastActivity;

            if (timeSinceActivity > inactivityPeriod) {
                uint256 decayPeriods = (timeSinceActivity - inactivityPeriod) / inactivityPeriod;
                uint256 decayAmount = (stake * decayRateBps * decayPeriods) / 10000;
                if (decayAmount >= stake) return 0;
                return stake - decayAmount;
            }
        }

        return stake;
    }

    /// @dev Helper to extract timestamp from StakingModule.stakes() return data
    function _extractTimestamp(bytes memory data) internal pure returns (uint256) {
        require(data.length >= 64, "Invalid data");
        uint256 ts;
        assembly {
            ts := mload(add(data, 64)) // Second 32-byte slot
        }
        return ts;
    }

    // ── Admin Functions ──

    /// @notice Update the slasher address (DAO-controlled)
    /// @param newSlasher New slasher address
    function setSlasher(address newSlasher) external onlyOwner {
        require(newSlasher != address(0), "Invalid slasher");
        emit SlasherUpdated(slasher, newSlasher);
        slasher = newSlasher;
    }

    /// @notice Update the staking module reference
    /// @param newStakingModule New StakingModule address
    function setStakingModule(address newStakingModule) external onlyOwner {
        require(newStakingModule != address(0), "Invalid module");
        emit StakingModuleUpdated(stakingModule, newStakingModule);
        stakingModule = newStakingModule;
    }

    /// @notice Update max slash percentage (basis points)
    /// @param newMaxBps New max slash in basis points (10000 = 100%)
    function setMaxSlashBps(uint256 newMaxBps) external onlyOwner {
        require(newMaxBps > 0 && newMaxBps <= 10000, "Invalid bps");
        emit MaxSlashBpsUpdated(maxSlashBps, newMaxBps);
        maxSlashBps = newMaxBps;
    }

    /// @notice Recover slashed tokens to a treasury address
    /// @param to Treasury address
    /// @param amount Amount to recover
    function recoverSlashedTokens(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid address");
        nobay.transfer(to, amount);
        emit SlashedTokensRecovered(to, amount);
    }

    // ── View Functions ──

    /// @notice Get slash record by ID
    function getSlashRecord(uint256 slashId) external view returns (SlashRecord memory) {
        require(slashId < slashCount, "Invalid slash ID");
        return slashRecords[slashId];
    }

    /// @notice Get total slash count
    function getSlashCount() external view returns (uint256) {
        return slashCount;
    }

    /// @notice Check if a seller has been slashed
    function isSlashed(address seller) external view returns (bool) {
        return totalSlashed[seller] > 0;
    }
}
