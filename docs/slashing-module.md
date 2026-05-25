# Slashing Module

`SlashingModule` adds a DAO-compatible path for reducing seller stake after fraud or dispute outcomes.

## Flow

1. Deploy `SlashingModule` with the `StakingModule`, DAO executor, and slash-recipient treasury addresses.
2. Call `StakingModule.setSlashingModule(address(slashingModule))` from the staking owner or DAO.
3. Configure dispute resolvers with `setDisputeResolver`.
4. Slash either through `slashByDAO` after a DAO vote, or `slashByDispute` after an approved dispute resolver reaches an outcome.

Slashed stake is transferred to the configured recipient, usually the DAO treasury. Partial slashes restart the seller cooldown so the remaining stake cannot be withdrawn immediately after a dispute.

## Trust Decay

Sellers start at `MAX_TRUST_SCORE` and lose trust on each slash. `trustScore` applies a configurable per-day decay from the last checkpoint, while `applyTrustDecay` checkpoints the decayed score for indexers or frontends.
