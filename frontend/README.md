# Nobay Listing Discovery PWA

Minimal React/Vite interface for browsing verified listings from `ListingRegistry` events and displaying seller trust tiers from `StakingModule`.

## Features

- Connect injected wallet, or use an RPC URL in read-only mode.
- Read `ListingVerified` events from `ListingRegistry`.
- Query `StakingModule.getTier(seller)` for seller trust.
- Filter by keyword/seller/URI and minimum trust tier.
- Convert `ipfs://` listing metadata URIs to a public gateway link.

## Run

```bash
cd frontend
npm install
npm run dev
```

Enter deployed contract addresses and a starting block, then click **Load listings**.
