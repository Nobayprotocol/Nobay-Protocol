import React, { useState, useMemo } from 'react';
import { useNobayContracts } from '../hooks/useNobayContracts';
import { FilterBar } from './FilterBar';
import { ListingCard } from './ListingCard';

// Placeholder addresses - Replace with actual deployed contract addresses
const LISTING_REGISTRY_ADDRESS = import.meta.env.VITE_LISTING_REGISTRY_ADDRESS || '0xYourListingRegistryAddressHere';
const STAKING_MODULE_ADDRESS = import.meta.env.VITE_STAKING_MODULE_ADDRESS || '0xYourStakingModuleAddressHere';

export function DiscoveryEngine() {
  const { listings, loading, error, refetch } = useNobayContracts(LISTING_REGISTRY_ADDRESS, STAKING_MODULE_ADDRESS);
  
  const [filters, setFilters] = useState({
    keyword: '',
    tier: 0,
    sortBy: 'newest',
  });

  // Filter and Sort Logic
  const filteredListings = useMemo(() => {
    let result = [...listings];

    // Filter by Keyword (simple search on ID or Seller address substring)
    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase();
      result = result.filter(l => 
        l.id.toString().includes(kw) || 
        l.seller.toLowerCase().includes(kw)
      );
    }

    // Filter by Trust Tier
    if (filters.tier > 0) {
      result = result.filter(l => (l.trustTier ?? 0) >= filters.tier);
    }

    // Sort
    if (filters.sortBy === 'newest') {
      result.sort((a, b) => b.timestamp - a.timestamp);
    } else if (filters.sortBy === 'oldest') {
      result.sort((a, b) => a.timestamp - b.timestamp);
    } else if (filters.sortBy === 'tier') {
      result.sort((a, b) => (b.trustTier ?? 0) - (a.trustTier ?? 0));
    }

    return result;
  }, [listings, filters]);

  if (loading && listings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-slate-400">Loading Listings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800 text-red-200 p-4 rounded-lg">
        <p>Error loading data: {error}</p>
        <button onClick={refetch} className="mt-2 text-sm underline">Retry</button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Marketplace Listings</h2>
        <p className="text-slate-400">Discover verified assets from trusted sellers.</p>
      </div>

      <FilterBar filters={filters} setFilters={setFilters} />

      {filteredListings.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          No listings found matching your criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredListings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}
