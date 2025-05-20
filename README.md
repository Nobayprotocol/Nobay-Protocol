# Nobay Protocol

**Nobay** is a modular, open-source protocol for decentralized marketplaces.  
It replaces rent-seeking platforms with public infrastructure — enabling trustless, permissionless trade without custodians or centralized listing control.

This repository houses the protocol’s smart contracts, documentation, and developer tooling. It is designed to be forked, extended, and governed by a decentralized community.

---

## Why Nobay?

Most online marketplaces today are extractive.

They:
- Censor listings  
- Take a cut of every transaction  
- Control visibility through opaque algorithms  
- Ban users without recourse  
- Rent trust instead of building it

**Nobay changes this.**

It is not an app.  
It is not a platform.  
It is a protocol — designed to be unowned, composable, and forkable.

---

## What the Protocol Provides

Nobay is built from four modular layers:

### 1. **Listing Registry**
- Wallet-signed metadata stored via IPFS or Arweave  
- Public smart contracts track active listings  
- No centralized backend or listing approval logic  

### 2. **Staked Trust**
- Sellers stake $NOBAY to access higher trust tiers  
- Fulfillment rate and dispute outcomes shape reputation  
- Discovery engines can query public scoring APIs  

### 3. **Escrow and Dispute Resolution**
- Transactions can include bonded escrow  
- Disputes resolved by slashing-backed arbitration  
- Arbitrators can be DAO-governed or third-party plugins  

### 4. **Governance and Upgrades**
- Early governance by multisig (Phase I)  
- Long-term governance via Nobay DAO  
- DAO controls treasury, dispute court registry, emissions, and upgrades  

---

## Who It's For

- **Developers** building sovereign marketplaces  
- **DAOs** coordinating resource exchange or grants  
- **Communities** launching region- or vertical-specific economies  
- **Traders and sellers** seeking visibility without middlemen  

Fork it. Extend it. Govern it.  
**Nobay is infrastructure, not a product.**

---

## Repo Structure

```
nobay-protocol/
├── whitepaper/                 # Canonical PDF whitepaper
├── docs/                       # Architecture, tokenomics, governance specs
├── contracts/                  # Core protocol smart contracts (.sol)
├── frontend/                   # Reference wallet-native interface (optional)
├── scripts/                    # Deployment, migration, and setup tools
└── test/                       # Hardhat/Foundry unit tests
```

---

## Key Resources

- [Nobay Whitepaper (PDF)](./whitepaper/Nobay_Whitepaper.pdf)  
- [Protocol Architecture](./docs/protocol-architecture.md)  
- [Tokenomics](./docs/tokenomics.md)  
- [Governance](./docs/governance.md)  

Community links:
- Website (coming soon): https://nobay.xyz  
- Twitter/X: [@nobayprotocol](https://twitter.com/nobayprotocol)  
- Discord: [Join the DAO] *(placeholder)*

---

## Contribute

Nobay is a public good. We welcome contributors to help shape its future:

- Submit PRs for smart contract modules  
- Fork the frontend to create local verticals  
- Join the DAO to vote on key upgrades and funding proposals  

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) to get started.

---

## License

This protocol is licensed under the MIT License.  
You are free to use, fork, remix, and build on Nobay in any way that respects its neutral, non-custodial design.

---

> “Nobay is not the next eBay.  
> It’s the protocol that makes centralized marketplaces obsolete.”
