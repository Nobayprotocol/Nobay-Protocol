import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import ListingCard from './ListingCard';
import FilterBar from './FilterBar';
import { useListingCount, useListings } from '../hooks/useListings';

interface Listing {
  seller: string;
  uri: string;
  timestamp: bigint;
  active: boolean;
}

export default function ListingBrowser() {
  const { isConnected } = useAccount();
  const [filters, setFilters] = useState({
    keyword: '',
    tier: 'all',
    sortBy: 'timestamp',
  });
  
  const { data: listingCount } = useListingCount();
  const count = listingCount ? Number(listingCount) : 0;
  
  // Fetch last 50 listings (most recent first)
  const startId = Math.max(0, count - 50);
  const { data: listingsData, isLoading } = useListings(startId, Math.min(50, count));
  
  // Parse listings
  const listings: Listing[] = listingsData?.map((listing: any) => ({
    seller: listing[0],
    uri: listing[1],
    timestamp: listing[2],
    active: listing[3],
  })) || [];
  
  // Filter listings
  const filteredListings = listings
    .filter(listing => {
      if (filters.keyword && !listing.uri.toLowerCase().includes(filters.keyword.toLowerCase())) {
        return false;
      }
      // Note: Tier filtering would require fetching tier for each seller
      // For performance, we'll implement this with React Query batching
      return listing.active;
    })
    .sort((a, b) => {
      if (filters.sortBy === 'timestamp') {
        return Number(b.timestamp) - Number(a.timestamp);
      }
      return 0;
    });

  if (!isConnected) {
    return (
      <div className="text-center py-20">
        <div className="text-6xl mb-4">🔗</div>
        <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
        <p className="text-slate-400">Connect your wallet to browse decentralized listings</p>
      </div>
    );
  }

  return (
    <div>
      <FilterBar filters={filters} onFilterChange={setFilters} />
      
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-bold">
          {filteredListings.length} Listings Found
        </h2>
        <p className="text-slate-400 text-sm">
          Total: {count} listings
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nobay-500 mx-auto"></div>
          <p className="mt-4 text-slate-400">Loading listings...</p>
        </div>
      ) : filteredListings.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-xl font-semibold mb-2">No Listings Found</h3>
          <p className="text-slate-400">Try adjusting your filters or check back later</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredListings.map((listing, index) => (
            <ListingCard
              key={startId + index}
              listing={listing}
              listingId={startId + index}
            />
          ))}
        </div>
      )}
    </div>
  );
}
