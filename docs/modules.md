# Nobay Protocol Modules

This document provides a modular overview of the Nobay Protocol’s smart contracts. Each component is independently upgradeable and intentionally minimal — designed for permissionless forking, front-end flexibility, and DAO-controlled evolution.

---

## 1. Listing Registry

**File:** `contracts/ListingRegistry.sol`

### Purpose:
Stores wallet-signed, off-chain listings (IPFS or Arweave).  
Does not store full item data or pricing logic — only metadata hashes and EIP-712 signatures.

### Key Features:
- EIP-712 signature verification
- Minimal metadata: seller address, content hash, timestamp
- Emits `ListingVerified` event for indexing engines
- Extensible by discovery UIs, not hardcoded

---

## 2. Staking Module

**File:** `contracts/StakingModule.sol`

### Purpose:
Allows sellers to stake $NOBAY tokens and receive on-chain trust tiers. Tiers may be used by front-ends to filter, rank, or badge listings.

### Key Features:
- Tier system: Verified, Trusted, Elite (by amount staked)
- Cooldown before unstaking
- Slashing not included in MVP (to be DAO-controlled later)
- Emits `Staked` and `Unstaked` events

---

## 3. Escrow Contract

**File:** `contracts/Escrow.sol`

### Purpose:
Handles buyer protection during transactions.  
Funds are held in escrow until dispute window passes or dispute is resolved.

### Key Features:
- ETH or ERC20 compatible
- Dispute trigger by buyer
- Dispute resolution by owner (multisig/DAO in Phase 3)
- Emits `EscrowCreated`, `EscrowReleased`, `EscrowDisputed`, `EscrowResolved`

---

## 4. Slashing Module

**File:** `contracts/SlashingModule.sol`

### Purpose:
Provides DAO-compatible and dispute-based slashing of seller stakes, plus dynamic trust score decay over time.

### Key Features:
- Direct DAO execution (`slashByDAO`) & on-chain proposal voting (`proposeSlash`, `castVote`, `executeSlashProposal`)
- Dispute arbitrator resolution (`slashByDispute`) with replay protection
- Trust decay and recovery system (`getTrustScore`, `applyTrustDecay`, `getEffectiveStake`)
- Automatic transfer of slashed funds to protocol treasury
- Cooldown timer reset on partial slashing to prevent exit front-running
- Emits `Slashed(address, amount, reason)`

---

## 5. Governance

**File:** `docs/governance.md`

### Purpose:
Outlines governance transition:
- Multisig (3-of-5) in Phase 1
- Token-based DAO with Snapshot + Timelock in Phase 2+
- Full DAO control over upgrades, disputes, treasury in Phase 3

---

## 6. Token Utility

**File:** `docs/tokenomics.md`

### $NOBAY Roles:
- Stake to earn trust tiers (StakingModule)
- Vote in governance (Phase 2)
- Boost visibility or list access (future modules)

---

## Interactions Summary

| Module          | Inputs                                | Outputs                                    |
|-----------------|---------------------------------------|--------------------------------------------|
| ListingRegistry | Signed listings (off-chain)           | ListingVerified events                     |
| StakingModule   | $NOBAY stake                          | Tier level + Staked/Unstaked events        |
| SlashingModule  | DAO vote / dispute ruling             | Slashed events, trust penalties, treasury  |
| Escrow          | Payment, seller addr, token           | Funds released or disputed                 |
| Governance      | Snapshot vote, DAO params             | Contract upgrades, treasury control        |

---

## Roadmap

Future modules may include:
- SlashingController (trust penalties)
- ReputationOracle (score computation)
- DisputeCourt (arbitrator registry)
- EmissionsModule (DAO-controlled inflation)
- Multi-vault DAO treasury

---

This stack is built to be forked, remixed, and governed in public.

> Protocol, not platform.  
> Infrastructure, not interface.
