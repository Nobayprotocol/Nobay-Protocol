# Contributing to Nobay Protocol

Thanks for your interest in building, improving, or extending the Nobay Protocol.

Nobay is a modular, decentralized marketplace protocol — not a platform. All contributors are invited to treat this repository as a public infrastructure layer, forkable and community-governed.

---

## Repo Structure

```
/contracts/         → Core smart contracts (Listing, Escrow, Staking)
/docs/              → Protocol architecture, governance, and tokenomics
/whitepaper/        → Canonical PDF and references
/frontend/ (TBD)    → Wallet-native or PWA UI (coming soon)
```

---

## Local Setup

To build or test contracts locally:

```bash
# Clone the repo
git clone https://github.com/Nobayprotocol/Nobay-Protocol.git
cd Nobay-Protocol

# Install dependencies (choose one)
npm install       # For Hardhat
forge install     # For Foundry (optional)
```

Test and deploy flows coming soon via Hardhat or Foundry.

---

## Contributing Modules

You’re welcome to:
- Fork any contract and submit a pull request  
- Add extensions like Dispute Courts, Discovery Engines, Slashing layers  
- Translate the whitepaper  
- Write frontend components or dashboards  
- Improve documentation or security assumptions

---

## Governance & Proposals

Proposals will be staged via:
- GitHub Issues (open a discussion!)
- Snapshot (for DAO voting)
- On-chain DAO (via timelock contract, Phase 2)

> If you stake $NOBAY, you govern.

---

## Standards & Ethics

- MIT License — forks welcome  
- Open protocol: no closed-source modules will be merged  
- Slashing, arbitration, and governance decisions must be modular and auditable

---

## Communication

- Twitter: [@nobayprotocol](https://twitter.com/nobayprotocol)  
- Discord: *(TBA — add your link here)*  
- Governance dashboard: *(Coming Phase 2)*

---

## Thank You

This is just the beginning. Fork the stack. Remix the interface. Expand the protocol.

Let’s build sovereign marketplaces — together.
