# Nobay Frontend Scaffold

This folder defines the structure for building a decentralized frontend interface to the Nobay Protocol.

It is currently a scaffold to guide contributors and will evolve into a reference UI for interacting with the protocol’s smart contracts.

---

## Project Goals

The frontend should eventually enable users to:
- Browse verified listings
- View seller trust tiers (staking levels)
- Submit listings via signed metadata (EIP-712)
- Initiate escrow and track transaction status

---

## Recommended Stack

We recommend the following tools:
- Framework: React (Vite or Next.js)
- Wallet: wagmi + RainbowKit
- Contracts: Viem or Ethers.js
- Styling: TailwindCSS or minimal component library

Other stacks (Svelte, Vue) are welcome for forks or alternate interfaces.

---

## Directory Layout

```
/app/
  ├── components/      # UI components (e.g. badges, buttons)
  ├── pages/           # Views for home, listings, staking
  ├── hooks/           # Web3 connection and contract hooks
  ├── utils/           # Helper functions and formatters
  └── config/          # ABI and address configuration
```

---

## Contribution Notes

This structure is for contributors building experimental frontends. Please open a GitHub issue or pull request before submitting major structural changes.

> Nobay is not a platform. Fork the UI. Own the experience.
