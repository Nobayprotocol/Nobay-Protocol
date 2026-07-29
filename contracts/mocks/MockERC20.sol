// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockERC20
/// @notice Minimal ERC20 for testing — adds a public mint function.
contract MockERC20 is ERC20 {
    constructor() ERC20("Mock NOBAY", "mNOBAY") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
