# Nobay Discovery Engine

A decentralized marketplace listing discovery engine built with React, TypeScript, and Web3 technologies.

## Features

✨ **Core Features**
- 🔗 **Wallet Connection** - MetaMask, WalletConnect, and more via RainbowKit
- 📋 **Browse Listings** - View verified listings from ListingRegistry events
- 🏅 **Trust Tiers** - Display seller trust tiers from StakingModule
- 🔍 **Filter & Search** - Filter by keyword, trust tier, timestamp
- 📱 **PWA Ready** - Installable as a Progressive Web App

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Web3**: Wagmi + RainbowKit
- **State**: TanStack Query (React Query)
- **Routing**: React Router v6
- **PWA**: vite-plugin-pwa

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- A Web3 wallet (MetaMask recommended)

### Installation

```bash
# Clone the repo
git clone https://github.com/Nobayprotocol/Nobay-Protocol.git
cd Nobay-Protocol/frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### Configuration

1. **WalletConnect Project ID**
   
   Get your project ID from [WalletConnect Cloud](https://cloud.walletconnect.com/) and update `src/wagmi.ts`:
   
   ```typescript
   projectId: 'YOUR_PROJECT_ID',
   ```

2. **Contract Addresses**
   
   After deploying the smart contracts, update `src/lib/contracts.ts` with the deployed addresses:
   
   ```typescript
   export const CONTRACT_ADDRESSES = {
     1: { // Ethereum Mainnet
       listingRegistry: '0x...',
       stakingModule: '0x...',
     },
     // Add more chains as needed
   };
   ```

### Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory, ready to deploy to any static hosting service.

## Architecture

### Directory Structure

```
frontend/
├── src/
│   ├── components/       # React components
│   │   ├── Header.tsx
│   │   ├── ListingBrowser.tsx
│   │   ├── ListingCard.tsx
│   │   └── FilterBar.tsx
│   ├── hooks/           # Custom React hooks
│   │   ├── useListings.ts
│   │   └── useTrustTier.ts
│   ├── lib/             # Utilities and config
│   │   └── contracts.ts
│   ├── App.tsx          # Main app component
│   ├── main.tsx         # Entry point
│   ├── wagmi.ts         # Wagmi configuration
│   └── index.css        # Global styles
├── public/              # Static assets
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

### Smart Contract Integration

#### ListingRegistry.sol

The app reads `ListingVerified` events and queries listing data:

```typescript
const { data: listing } = useContractRead({
  address: LISTING_REGISTRY_ADDRESS,
  abi: LISTING_REGISTRY_ABI,
  functionName: 'listings',
  args: [listingId],
});
```

Each listing contains:
- `seller`: Address of the listing creator
- `uri`: IPFS/Arweave metadata hash
- `timestamp`: Unix timestamp
- `active`: Boolean status

#### StakingModule.sol

Trust tiers are fetched using:

```typescript
const { data: tier } = useContractRead({
  address: STAKING_MODULE_ADDRESS,
  abi: STAKING_MODULE_ABI,
  functionName: 'getTier',
  args: [sellerAddress],
});
```

Tiers:
- **Tier 0**: Unverified (< 1,000 NOBAY)
- **Tier 1**: Verified (≥ 1,000 NOBAY)
- **Tier 2**: Trusted (≥ 10,000 NOBAY)
- **Tier 3**: Elite (≥ 100,000 NOBAY)

### IPFS Metadata

Listings store metadata on IPFS. The expected format:

```json
{
  "title": "Vintage Camera",
  "description": "Rare 1960s film camera in excellent condition",
  "image": "ipfs://Qm.../image.jpg",
  "price": "0.5 ETH",
  "attributes": [...]
}
```

## Deployment

### Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Nobayprotocol/Nobay-Protocol/tree/main/frontend)

### Netlify

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/Nobayprotocol/Nobay-Protocol)

### Manual

```bash
npm run build
# Upload dist/ folder to your hosting provider
```

## Development

### Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Adding New Features

1. **New Contract Integration**
   - Add ABI to `src/lib/contracts.ts`
   - Create custom hook in `src/hooks/`
   - Use in components

2. **New UI Components**
   - Create in `src/components/`
   - Follow Tailwind styling patterns
   - Use TypeScript for type safety

3. **PWA Features**
   - Configure in `vite.config.ts`
   - Add icons to `public/`

## Contributing

Contributions are welcome! Please read our [Contributing Guide](../CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](../LICENSE)

## Support

- 📖 [Documentation](../docs/)
- 💬 [Discord](https://discord.gg/nobay)
- 🐛 [Issue Tracker](https://github.com/Nobayprotocol/Nobay-Protocol/issues)

---

Built with ❤️ by the Nobay Community
