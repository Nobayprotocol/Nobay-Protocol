// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title Escrow
/// @notice Holds buyer funds until dispute window passes or transaction is resolved
/// @dev Minimal MVP escrow with release + dispute flags (DAO arbitration in Phase 3)

contract Escrow is ReentrancyGuard, Ownable {
    enum EscrowStatus { Pending, Released, Disputed, Resolved }

    struct EscrowDeal {
        address buyer;
        address seller;
        address token; // address(0) = native ETH
        uint256 amount;
        uint256 createdAt;
        EscrowStatus status;
    }

    uint256 public dealCount;
    mapping(uint256 => EscrowDeal) public deals;

    uint256 public disputeWindow = 3 days;

    event EscrowCreated(uint256 indexed dealId, address buyer, address seller, address token, uint256 amount);
    event EscrowReleased(uint256 indexed dealId, address seller);
    event EscrowDisputed(uint256 indexed dealId, address buyer);
    event EscrowResolved(uint256 indexed dealId, address winner);

    /// @notice Create new escrow between buyer and seller
    function createEscrow(address seller, address token, uint256 amount) external payable nonReentrant returns (uint256) {
        if (token == address(0)) {
            require(msg.value == amount, "Incorrect ETH sent");
        } else {
            IERC20(token).transferFrom(msg.sender, address(this), amount);
        }

        deals[dealCount] = EscrowDeal({
            buyer: msg.sender,
            seller: seller,
            token: token,
            amount: amount,
            createdAt: block.timestamp,
            status: EscrowStatus.Pending
        });

        emit EscrowCreated(dealCount, msg.sender, seller, token, amount);
        return dealCount++;
    }

    /// @notice Release funds to seller after dispute window
    function release(uint256 dealId) external nonReentrant {
        EscrowDeal storage deal = deals[dealId];
        require(deal.status == EscrowStatus.Pending, "Not pending");
        require(block.timestamp >= deal.createdAt + disputeWindow, "Too early to release");

        deal.status = EscrowStatus.Released;
        _payout(deal.seller, deal.token, deal.amount);

        emit EscrowReleased(dealId, deal.seller);
    }

    /// @notice Trigger a dispute (Phase 3 arbitration may handle this)
    function dispute(uint256 dealId) external {
        EscrowDeal storage deal = deals[dealId];
        require(msg.sender == deal.buyer, "Only buyer can dispute");
        require(deal.status == EscrowStatus.Pending, "Cannot dispute");

        deal.status = EscrowStatus.Disputed;
        emit EscrowDisputed(dealId, msg.sender);
    }

    /// @notice Admin resolves a dispute manually (Phase 3: DAO or court)
    function resolve(uint256 dealId, address winner) external onlyOwner nonReentrant {
        EscrowDeal storage deal = deals[dealId];
        require(deal.status == EscrowStatus.Disputed, "Not in dispute");

        deal.status = EscrowStatus.Resolved;
        _payout(winner, deal.token, deal.amount);

        emit EscrowResolved(dealId, winner);
    }

    function _payout(address to, address token, uint256 amount) internal {
        if (token == address(0)) {
            payable(to).transfer(amount);
        } else {
            IERC20(token).transfer(to, amount);
        }
    }

    /// @notice Update dispute window (DAO-controlled in Phase 3)
    function setDisputeWindow(uint256 time) external onlyOwner {
        disputeWindow = time;
    }
}
