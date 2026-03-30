// contracts/modules/SlashingModule.sol

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./StakingModule.sol";

contract SlashingModule is Ownable {
    StakingModule public stakingModule;
    mapping(address => uint256) public trustScores;
    uint256 public trustDecayRate = 10; // 10% decay per day

    event Slashed(address indexed staker, uint256 amount, string reason);

    constructor(address _stakingModuleAddress) {
        stakingModule = StakingModule(_stakingModuleAddress);
    }

    function slash(address staker, uint256 amount, string memory reason) external onlyOwner {
        require(amount > 0, "Amount must be greater than zero");
        require(stakingModule.balanceOf(staker) >= amount, "Insufficient staking balance");

        stakingModule.burn(staker, amount);
        emit Slashed(staker, amount, reason);

        // Update trust score
        trustScores[staker] = trustScores[staker] > amount ? trustScores[staker] - amount : 0;
    }

    function applyTrustDecay(address staker) external {
        trustScores[staker] = trustScores[staker] * (100 - trustDecayRate) / 100;
    }

    function getTrustScore(address staker) external view returns (uint256) {
        return trustScores[staker];
    }
}