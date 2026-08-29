# Slashing Module

`SlashingModule` provides a DAO-compatible, dispute-integrated slashing mechanism for $NOBAY stakers on the Nobay Protocol.

## Overview

- **Contract:** `contracts/SlashingModule.sol`
- **Interfaces:** `contracts/ISlashingModule.sol`, `contracts/IStakingModule.sol`

The module enables protocol participants to penalize bad actors (such as sellers submitting fraudulent listings or losing transaction disputes) by slashing their active staked $NOBAY tokens.

## Key Features

1. **DAO-Controlled Slashing:**
   - Slashing directly executable by DAO governance (`slashByDAO`).
   - On-chain proposal creation, stake-weighted voting, and timelocked execution (`proposeSlash`, `castVote`, `executeSlashProposal`).

2. **Dispute Outcome Integration:**
   - Slashing callable by designated arbitrator courts and dispute resolvers (`slashByDispute`).
   - Replay protection for dispute IDs (`disputeProcessed`) prevents double-penalization.

3. **StakingModule Integration:**
   - Configured in `StakingModule` via `setSlashingModule`.
   - Slashed tokens are transferred directly to the designated protocol treasury.
   - Partial slashes reset the cooldown timer on remaining stakes to prevent fraudulent exit front-running.
   - 100% slashes deactivate the stake.

4. **Trust Decay and Recovery (Bonus Feature):**
   - Trust scores are tracked on a scale from 0 to 10,000 (representing 0% to 100.00%).
   - Infractions apply a proportional penalty to the seller's trust score.
   - After a configurable decay period (e.g. 30 days), trust gradually recovers at a configurable daily rate (e.g. 100 bps / 1% per day).
   - On-chain checkpointing via `applyTrustDecay(address staker)`.
   - Dynamic effective stake view via `getEffectiveStake(address staker)`.

5. **Events:**
   - Emits canonical `Slashed(address indexed staker, uint256 amount, string reason)`.
   - Emits detailed telemetry: `SlashedByDAO`, `SlashedByDispute`, `SlashProposed`, `SlashVoteCast`, `SlashProposalExecuted`, `TrustScoreUpdated`.

## Architecture Diagram

```
+-------------------------------------------------------------+
|                      Nobay DAO / Multisig                   |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                     SlashingModule.sol                      |
|                                                             |
|  - slashByDAO(staker, amount, reason)                       |
|  - slashByDispute(staker, disputeId, amount, reason)        |
|  - proposeSlash(...) / castVote(...) / executeProposal(...) |
|  - getTrustScore(staker) / getEffectiveStake(staker)        |
|  - applyTrustDecay(staker)                                  |
+------------------------------+------------------------------+
                               | calls slash(staker, amount, treasury, reason)
                               v
+-------------------------------------------------------------+
|                     StakingModule.sol                       |
|  - Holds $NOBAY collateral                                  |
|  - Deducts staked balance                                   |
|  - Resets cooldown / updates tier                           |
|  - Transfers slashed tokens to DAO Treasury                 |
+-------------------------------------------------------------+
```
