// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title StakingModule
/// @notice Allows sellers to stake $NOBAY for trust tier assignment
/// @dev Modular contract, upgradeable by DAO later

contract StakingModule is Ownable {
    IERC20 public immutable nobay;
    address public slashingModule;

    struct Stake {
        uint256 amount;
        uint256 timestamp;
        bool active;
    }

    mapping(address => Stake) public stakes;

    uint256 public cooldownPeriod = 3 days;

    event Staked(address indexed seller, uint256 amount, uint256 timestamp);
    event Unstaked(address indexed seller, uint256 amount, uint256 timestamp);
    event SlashingModuleUpdated(address indexed module);
    event Slashed(address indexed seller, address indexed recipient, uint256 amount, string reason, uint256 timestamp);

    constructor(address _nobay) {
        nobay = IERC20(_nobay);
    }

    modifier onlySlashingModule() {
        require(msg.sender == slashingModule && slashingModule != address(0), "Not slashing module");
        _;
    }

    /// @notice Stake $NOBAY tokens to enter trust tiers
    /// @param amount Number of tokens to stake
    function stake(uint256 amount) external {
        require(amount > 0, "Cannot stake zero");

        require(nobay.transferFrom(msg.sender, address(this), amount), "Stake transfer failed");

        stakes[msg.sender].amount += amount;
        stakes[msg.sender].timestamp = block.timestamp;
        stakes[msg.sender].active = true;

        emit Staked(msg.sender, amount, block.timestamp);
    }

    /// @notice Unstake tokens after cooldown
    function unstake() external {
        Stake storage s = stakes[msg.sender];
        require(s.active, "No active stake");
        require(block.timestamp >= s.timestamp + cooldownPeriod, "Cooldown not met");

        uint256 amount = s.amount;
        require(amount > 0, "Nothing to unstake");

        s.amount = 0;
        s.active = false;

        require(nobay.transfer(msg.sender, amount), "Unstake transfer failed");
        emit Unstaked(msg.sender, amount, block.timestamp);
    }

    /// @notice Slash a seller's active stake through the configured slashing module
    /// @dev Restarts the seller cooldown on partial slash to prevent immediate exit after a dispute
    /// @param seller Seller whose stake should be slashed
    /// @param amount Number of staked $NOBAY tokens to slash
    /// @param recipient Address receiving the slashed stake, usually the DAO treasury
    /// @param reason Human-readable DAO/dispute reason emitted for indexers
    function slash(
        address seller,
        uint256 amount,
        address recipient,
        string calldata reason
    ) external onlySlashingModule {
        require(seller != address(0), "Invalid seller");
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Cannot slash zero");

        Stake storage s = stakes[seller];
        require(s.active, "No active stake");
        require(s.amount >= amount, "Insufficient stake");

        s.amount -= amount;
        if (s.amount == 0) {
            s.active = false;
        } else {
            s.timestamp = block.timestamp;
        }

        require(nobay.transfer(recipient, amount), "Slash transfer failed");
        emit Slashed(seller, recipient, amount, reason, block.timestamp);
    }

    /// @notice Returns current trust tier based on stake amount
    function getTier(address seller) public view returns (uint8) {
        uint256 amount = stakes[seller].amount;
        if (amount >= 100_000 * 1e18) return 3; // Elite
        if (amount >= 10_000 * 1e18) return 2;  // Trusted
        if (amount >= 1_000 * 1e18) return 1;   // Verified
        return 0; // Unverified
    }

    /// @notice Allows DAO/owner to update cooldown window
    function setCooldown(uint256 newCooldown) external onlyOwner {
        cooldownPeriod = newCooldown;
    }

    /// @notice Sets the module allowed to slash seller stakes
    function setSlashingModule(address module) external onlyOwner {
        slashingModule = module;
        emit SlashingModuleUpdated(module);
    }

    /// @notice Returns the seller's current staked amount for external modules
    function stakedBalance(address seller) external view returns (uint256) {
        return stakes[seller].amount;
    }
}
