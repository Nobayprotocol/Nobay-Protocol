// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IStakingModule {
    function slash(address user, uint256 amount) external;
}

/// @title SlashingModule
/// @notice Allows DAO to slash $NOBAY stakers for fraud or dispute resolution.
contract SlashingModule is Ownable {
    IStakingModule public stakingModule;
    
    mapping(address => bool) public authorizedSlashers;
    
    // Trust decay parameters (Bonus feature)
    uint256 public constant DECAY_RATE_PER_DAY = 10; // e.g., 10 basis points decay per day of inactivity/infraction
    mapping(address => uint256) public lastInfractionTime;

    event Slashed(address indexed user, uint256 amount, string reason);
    event SlasherAuthorized(address indexed slasher, bool status);

    constructor(address _stakingModule) Ownable(msg.sender) {
        stakingModule = IStakingModule(_stakingModule);
    }

    modifier onlySlasher() {
        require(authorizedSlashers[msg.sender] || msg.sender == owner(), "Not authorized slasher");
        _;
    }

    function setSlasher(address slasher, bool status) external onlyOwner {
        authorizedSlashers[slasher] = status;
        emit SlasherAuthorized(slasher, status);
    }

    /// @notice Execute a slash on a user's stake
    function executeSlash(address user, uint256 amount, string calldata reason) external onlySlasher {
        stakingModule.slash(user, amount);
        lastInfractionTime[user] = block.timestamp;
        emit Slashed(user, amount, reason);
    }
    
    /// @notice Calculate trust decay based on time since last infraction
    function calculateTrustDecay(address user) external view returns (uint256) {
        uint256 lastInfraction = lastInfractionTime[user];
        if (lastInfraction == 0) return 0;
        
        uint256 daysSince = (block.timestamp - lastInfraction) / 1 days;
        return daysSince * DECAY_RATE_PER_DAY;
    }
}
