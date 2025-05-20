# Nobay Frontend (Prototype)

This folder will house reference interfaces, frontends, and wallet-native experiences for interacting with the Nobay Protocol.

We welcome forks, new UIs, and minimalist discovery engines.

---

## Goals

- Wallet-native interface (MetaMask, WalletConnect)
- Display listings from `ListingRegistry.sol`
- Show seller trust tiers (from `StakingModule.sol`)
- Optional: initiate escrow (ETH or token payments)
- Optional: submit a listing (off-chain signed URI + signature)

---

## Stack Recommendation (Optional)

You may use:
- React or Next.js (for listing browser)
- Wagmi + RainbowKit (wallet handling)
- Ethers.js or Viem (contract reads/writes)
- Tailwind or UI-neutral styles

Forks can use SvelteKit, Vue, or vanilla JS.

---

## Suggested MVP Flow

- Connect wallet  
- Browse `ListingVerified` events  
- Pull metadata via IPFS  
- Show seller trust badge (Tier 0–3)  
- Optional: button to submit listing via EIP-712 signature + URI

---

## Contributing

Open an issue or PR to discuss frontend architecture.  
Feel free to create alternate UIs for:

- Niche marketplaces (e.g., physical art, freelance, rare books)  
- Localized forks (e.g., EU, LatAm, SEA markets)  
- Dark/industrial UI variants for discovery pages

---

## Build Status

This folder is awaiting its first contributor-built PWA.  
Want to help? Open [Issue #2](https://github.com/Nobayprotocol/Nobay-Protocol/issues/2) to get started.
