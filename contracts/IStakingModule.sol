// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title IStakingModule
/// @notice Interface for StakingModule integration
interface IStakingModule {
    struct Stake {
        uint256 amount;
        uint256 timestamp;
        bool active;
    }

    function nobay() external view returns (IERC20);
    function stakes(address seller) external view returns (uint256 amount, uint256 timestamp, bool active);
    function stakedBalance(address seller) external view returns (uint256);
    function isStaked(address seller) external view returns (bool);
    function getTier(address seller) external view returns (uint8);
    function slash(address seller, uint256 amount, address recipient, string memory reason) external;
    function slashStaker(address staker, uint256 amount) external;
    function cooldownPeriod() external view returns (uint256);
    function stake(uint256 amount) external;
    function unstake() external;
}
