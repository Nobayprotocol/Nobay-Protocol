// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title StakingModule
/// @notice Allows sellers to stake $NOBAY for trust tier assignment
/// @dev Modular contract, upgradeable by DAO later, no slashing in MVP

contract StakingModule is Ownable {
    IERC20 public immutable nobay;

    struct Stake {
        uint256 amount;
        uint256 timestamp;
        bool active;
    }

    mapping(address => Stake) public stakes;

    uint256 public cooldownPeriod = 3 days;

    event Staked(address indexed seller, uint256 amount, uint256 timestamp);
    event Unstaked(address indexed seller, uint256 amount, uint256 timestamp);

    constructor(address _nobay) {
        nobay = IERC20(_nobay);
    }

    /// @notice Stake $NOBAY tokens to enter trust tiers
    /// @param amount Number of tokens to stake
    function stake(uint256 amount) external {
        require(amount > 0, "Cannot stake zero");

        nobay.transferFrom(msg.sender, address(this), amount);

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

        nobay.transfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount, block.timestamp);
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
}
