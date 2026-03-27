// Contract ABIs
export const LISTING_REGISTRY_ABI = [
  {
    inputs: [],
    name: 'listingCount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    name: 'listings',
    outputs: [
      { internalType: 'address', name: 'seller', type: 'address' },
      { internalType: 'string', name: 'uri', type: 'string' },
      { internalType: 'uint256', name: 'timestamp', type: 'uint256' },
      { internalType: 'bool', name: 'active', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'listingId', type: 'uint256' },
      { indexed: true, name: 'seller', type: 'address' },
      { indexed: false, name: 'uri', type: 'string' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
    name: 'ListingVerified',
    type: 'event',
  },
] as const;

export const STAKING_MODULE_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'seller', type: 'address' }],
    name: 'getTier',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Contract addresses (update after deployment)
export const CONTRACT_ADDRESSES = {
  1: { // Ethereum Mainnet
    listingRegistry: '0x0000000000000000000000000000000000000000',
    stakingModule: '0x0000000000000000000000000000000000000000',
  },
  137: { // Polygon
    listingRegistry: '0x0000000000000000000000000000000000000000',
    stakingModule: '0x0000000000000000000000000000000000000000',
  },
} as const;

export const TIER_NAMES = ['Unverified', 'Verified', 'Trusted', 'Elite'];
export const TIER_COLORS = ['tier-0', 'tier-1', 'tier-2', 'tier-3'];
