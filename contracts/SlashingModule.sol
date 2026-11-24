// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IStakingModule {
    function slash(address user, uint256 amount) external;
}

/// @title SlashingModule
/// @notice DAO-compatible slashing module for fraud or dispute resolution
contract SlashingModule is Ownable {
    IStakingModule public stakingModule;
    
    event Slashed(address indexed target, uint256 amount, string reason);
    event TrustDecayed(address indexed target, uint256 newTrustScore);
    
    constructor(address _stakingModule) {
        stakingModule = IStakingModule(_stakingModule);
    }
    
    function setStakingModule(address _stakingModule) external onlyOwner {
        stakingModule = IStakingModule(_stakingModule);
    }
    
    function executeSlash(address target, uint256 amount, string calldata reason) external onlyOwner {
        stakingModule.slash(target, amount);
        emit Slashed(target, amount, reason);
    }
    
    function decayTrust(address target, uint256 newTrustScore) external onlyOwner {
        emit TrustDecayed(target, newTrustScore);
    }
}
