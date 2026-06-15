import { useState, useEffect, useCallback } from 'react';
import { BrowserProvider, Contract } from 'ethers';
import { LISTING_REGISTRY_ABI, STAKING_MODULE_ABI, TRUST_TIERS } from '../contracts/abi';
import { getContractAddresses } from '../contracts/addresses';

export interface Listing {
  id: number;
  seller: string;
  uri: string;
  timestamp: number;
  active: boolean;
  trustTier: number;
  trustLabel: string;
  trustColor: string;
}

export function useListings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);

  const fetchListings = useCallback(async () => {
    if (!window.ethereum) {
      setError('No wallet detected. Please install MetaMask.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const provider = new BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      const cid = Number(network.chainId);
      setChainId(cid);

      const addresses = getContractAddresses(cid);
      
      // Check if contracts are deployed
      if (addresses.listingRegistry === '0x0000000000000000000000000000000000000000') {
        setError(`No deployed contracts found for chain ${cid}. Please deploy contracts first or switch network.`);
        setLoading(false);
        return;
      }

      const listingContract = new Contract(
        addresses.listingRegistry,
        LISTING_REGISTRY_ABI,
        provider
      );

      const stakingContract = new Contract(
        addresses.stakingModule,
        STAKING_MODULE_ABI,
        provider
      );

      // Get listing count
      const count = await listingContract.listingCount();
      const totalListings = Number(count);

      if (totalListings === 0) {
        setListings([]);
        setLoading(false);
        return;
      }

      // Fetch all listings
      const listingPromises = [];
      for (let i = 0; i < totalListings; i++) {
        listingPromises.push(
          listingContract.listings(i).then(async (listing: any) => {
            // Get trust tier for the seller
            let trustTier = 0;
            try {
              trustTier = Number(await stakingContract.getTier(listing.seller));
            } catch {
              trustTier = 0;
            }

            const tierInfo = TRUST_TIERS[trustTier] || TRUST_TIERS[0];

            return {
              id: i,
              seller: listing.seller,
              uri: listing.uri,
              timestamp: Number(listing.timestamp),
              active: listing.active,
              trustTier,
              trustLabel: tierInfo.label,
              trustColor: tierInfo.color,
            };
          })
        );
      }

      const results = await Promise.all(listingPromises);
      // Sort by timestamp descending (newest first)
      results.sort((a, b) => b.timestamp - a.timestamp);
      setListings(results);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch listings');
      console.error('Error fetching listings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchListings();

    // Listen for new listings via events
    if (window.ethereum) {
      const handleChainChanged = () => {
        fetchListings();
      };
      window.ethereum.on('chainChanged', handleChainChanged);
      return () => {
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, [fetchListings]);

  return { listings, loading, error, chainId, refresh: fetchListings };
}
