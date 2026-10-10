import { useState, useEffect, useCallback } from 'react';
import { useAccount, useReadContract, useWatchContractEvent } from 'wagmi';
import { parseAbiItem } from 'viem';

// ABI Snippets - Replace these with actual contract ABIs from your deployment
const LISTING_REGISTRY_ABI = [
  {
    inputs: [],
    name: 'getLatestListings',
    outputs: [
      { internalType: 'uint256[]', name: 'ids', type: 'uint256[]' },
      { internalType: 'address[]', name: 'sellers', type: 'address[]' },
      { internalType: 'string[]', name: 'metadataURIs', type: 'string[]' },
      { internalType: 'uint256[]', name: 'timestamps', type: 'uint256[]' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'uint256', name: 'listingId', type: 'uint256' }],
    name: 'listings',
    outputs: [
      { internalType: 'address', name: 'seller', type: 'address' },
      { internalType: 'string', name: 'metadataURI', type: 'string' },
      { internalType: 'uint256', name: 'timestamp', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  }
];

const STAKING_MODULE_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'getTrustTier',
    outputs: [{ internalType: 'uint8', name: 'tier', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function'
  }
];

const LISTING_VERIFIED_EVENT = parseAbiItem(
  'event ListingVerified(uint256 indexed listingId, address indexed seller, string metadataURI)'
);

export function useNobayContracts(listingRegistryAddress, stakingModuleAddress) {
  const { address } = useAccount();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch initial listings
  const { data: rawListings, refetch } = useReadContract({
    address: listingRegistryAddress,
    abi: LISTING_REGISTRY_ABI,
    functionName: 'getLatestListings',
    args: [],
  });

  // Watch for new ListingVerified events
  useWatchContractEvent({
    address: listingRegistryAddress,
    abi: LISTING_REGISTRY_ABI,
    eventName: 'ListingVerified',
    onLogs: (logs) => {
      // In a real app, you'd update the list here. 
      // For simplicity, we'll trigger a refetch when a new event occurs.
      refetch();
    },
  });

  // Process raw data into usable state
  useEffect(() => {
    if (!rawListings) return;

    const ids = rawListings[0];
    const sellers = rawListings[1];
    const metadataURIs = rawListings[2];
    const timestamps = rawListings[3];

    const processedListings = ids.map((id, index) => ({
      id: Number(id),
      seller: sellers[index],
      metadataURI: metadataURIs[index],
      timestamp: Number(timestamps[index]),
      trustTier: null, // Will be fetched asynchronously
    }));

    setListings(processedListings);
  }, [rawListings]);

  // Fetch Trust Tiers for all current listings
  const fetchTrustTiers = useCallback(async () => {
    if (!stakingModuleAddress || !listings.length) return;

    setLoading(true);
    try {
      const promises = listings.map(async (listing) => {
        try {
          const tierData = await window.wagmiClient.readContract({
            address: stakingModuleAddress,
            abi: STAKING_MODULE_ABI,
            functionName: 'getTrustTier',
            args: [listing.seller],
          });
          return { ...listing, trustTier: Number(tierData) };
        } catch (e) {
          console.error(`Failed to fetch tier for ${listing.seller}`, e);
          return { ...listing, trustTier: 0 }; // Default to lowest tier on error
        }
      });

      const updatedListings = await Promise.all(promises);
      setListings(updatedListings);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [listings, stakingModuleAddress]);

  useEffect(() => {
    if (listings.length > 0 && !listings[0].trustTier !== null) {
      fetchTrustTiers();
    }
  }, [listings.length, fetchTrustTiers]);

  return { listings, loading, error, refetch };
}
