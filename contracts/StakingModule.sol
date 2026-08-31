// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IStakingModule.sol";

/// @title StakingModule
/// @notice Allows sellers to stake $NOBAY for trust tier assignment
/// @dev Modular contract, upgradeable by DAO, integrated with SlashingModule

contract StakingModule is IStakingModule, Ownable {
    IERC20 public immutable override nobay;

    address public slashingModule;

    mapping(address => Stake) public override stakes;

    uint256 public override cooldownPeriod = 3 days;

    event Staked(address indexed seller, uint256 amount, uint256 timestamp);
    event Unstaked(address indexed seller, uint256 amount, uint256 timestamp);
    event SlashingModuleUpdated(address indexed module);
    event StakeSlashed(address indexed seller, address indexed recipient, uint256 amount, string reason, uint256 timestamp);

    modifier onlySlashingModule() {
        require(
            msg.sender == slashingModule || msg.sender == owner(),
            "StakingModule: caller is not authorized to slash"
        );
        _;
    }

    constructor(address _nobay) {
        require(_nobay != address(0), "StakingModule: zero token address");
        nobay = IERC20(_nobay);
    }

    /// @notice Stake $NOBAY tokens to enter trust tiers
    /// @param amount Number of tokens to stake
    function stake(uint256 amount) external override {
        require(amount > 0, "Cannot stake zero");

        require(nobay.transferFrom(msg.sender, address(this), amount), "Stake transfer failed");

        stakes[msg.sender].amount += amount;
        stakes[msg.sender].timestamp = block.timestamp;
        stakes[msg.sender].active = true;

        emit Staked(msg.sender, amount, block.timestamp);
    }

    /// @notice Unstake tokens after cooldown
    function unstake() external override {
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

    /// @notice Slash a seller's stake (called by SlashingModule or owner/DAO)
    /// @param seller Address of the seller being slashed
    /// @param amount Number of tokens to slash
    /// @param recipient Address receiving the slashed tokens (e.g. DAO treasury)
    /// @param reason Explanation for the slash
    function slash(
        address seller,
        uint256 amount,
        address recipient,
        string memory reason
    ) external override onlySlashingModule {
        require(seller != address(0), "StakingModule: invalid seller");
        require(recipient != address(0), "StakingModule: invalid recipient");
        require(amount > 0, "StakingModule: cannot slash zero");

        Stake storage s = stakes[seller];
        require(s.active, "StakingModule: no active stake");
        require(s.amount >= amount, "StakingModule: insufficient stake");

        s.amount -= amount;
        if (s.amount == 0) {
            s.active = false;
        } else {
            // Reset cooldown on partial slash to prevent front-running exit
            s.timestamp = block.timestamp;
        }

        require(nobay.transfer(recipient, amount), "Slash transfer failed");
        emit StakeSlashed(seller, recipient, amount, reason, block.timestamp);
    }

    /// @notice Backward-compatible slash staker method
    /// @param staker Address of staker
    /// @param amount Amount to slash
    function slashStaker(address staker, uint256 amount) external override onlySlashingModule {
        Stake storage s = stakes[staker];
        require(s.active, "StakingModule: no active stake");
        require(amount > 0, "StakingModule: cannot slash zero");
        require(s.amount >= amount, "StakingModule: insufficient stake");

        s.amount -= amount;
        if (s.amount == 0) {
            s.active = false;
        } else {
            s.timestamp = block.timestamp;
        }
    }

    /// @notice Returns current trust tier based on stake amount
    function getTier(address seller) public view override returns (uint8) {
        uint256 amount = stakes[seller].amount;
        if (amount >= 100_000 * 1e18) return 3; // Elite
        if (amount >= 10_000 * 1e18) return 2;  // Trusted
        if (amount >= 1_000 * 1e18) return 1;   // Verified
        return 0; // Unverified
    }

    /// @notice Returns the staked balance of an account
    /// @param seller Address of seller/staker
    function stakedBalance(address seller) external view override returns (uint256) {
        return stakes[seller].amount;
    }

    /// @notice Checks if an account has an active stake
    /// @param seller Address of seller/staker
    function isStaked(address seller) external view override returns (bool) {
        return stakes[seller].active;
    }

    /// @notice Allows DAO/owner to update cooldown window
    function setCooldown(uint256 newCooldown) external onlyOwner {
        cooldownPeriod = newCooldown;
    }

    /// @notice Configures the authorized slashing module
    /// @param module Address of the SlashingModule
    function setSlashingModule(address module) external onlyOwner {
        slashingModule = module;
        emit SlashingModuleUpdated(module);
    }
}
