# Nobay Protocol — Listing Discovery Engine

A simple web interface that pulls verified listings from the Nobay Protocol ListingRegistry contract.

## Features

- Connect via MetaMask or WalletConnect
- Read ListingVerified events from the contract
- Display seller trust tier from StakingModule
- Filter by keyword, trust tier, or timestamp
- PWA support (installable, offline-capable)

## Stack

- React 18 + Vite
- ethers.js v6 for blockchain interaction
- Tailwind CSS for styling
- RainbowKit for wallet connection

## Setup

```bash
cd frontend/app
npm install
npm run dev
```

## Smart Contract Integration

The app connects to deployed Nobay Protocol contracts:

- **ListingRegistry**: Reads `ListingVerified` events and listing data
- **StakingModule**: Reads seller trust tiers via `getTier(address)`
- **SlashingModule**: (Optional) Displays slash history

### Supported Networks

- Base Mainnet (chainId: 8453)
- Base Sepolia Testnet (chainId: 84532)
- Hardhat Local (chainId: 31337)

## Project Structure

```
app/
├── src/
│   ├── components/
│   │   ├── ConnectWallet.tsx    # Wallet connection button
│   │   ├── ListingCard.tsx      # Individual listing display
│   │   ├── ListingGrid.tsx      # Grid of all listings
│   │   ├── FilterBar.tsx        # Search and filter controls
│   │   └── TrustBadge.tsx       # Trust tier badge
│   ├── hooks/
│   │   ├── useListings.ts       # Fetch listings from contract
│   │   ├── useTrustTier.ts      # Fetch seller trust tier
│   │   └── useContract.ts       # Contract interaction hook
│   ├── contracts/
│   │   ├── abi/                 # Contract ABIs
│   │   └── addresses.ts         # Deployed addresses per chain
│   ├── App.tsx                  # Main app component
│   └── main.tsx                 # Entry point
├── public/
│   ├── manifest.json            # PWA manifest
│   └── icons/                   # PWA icons
└── package.json
```

## License

MIT — Nobay Protocol is forkable infrastructure.
