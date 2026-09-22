import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import ListingList from './components/ListingList';
import FilterBar from './components/FilterBar';
import { Listing, FilterState } from './types';
import { getListingRegistry, getStakingModule } from './utils/contract';

const LISTING_REGISTRY_ADDRESS = process.env.REACT_APP_LISTING_REGISTRY_ADDRESS!;
const STAKING_MODULE_ADDRESS = process.env.REACT_APP_STAKING_MODULE_ADDRESS!;
const NETWORK = process.env.REACT_APP_NETWORK || 'goerli';

const App: React.FC = () => {
  const [listings, setListings] = useState<Listing[]>([]);
  const [filter, setFilter] = useState<FilterState>({
    keyword: '',
    tier: '',
    startTime: '',
    endTime: '',
  });

  // Load listings on mount
  useEffect(() => {
    const loadListings = async () => {
      const provider = new ethers.providers.Web3Provider(
        (window as any).ethereum
      );
      const registry = getListingRegistry(provider, LISTING_REGISTRY_ADDRESS);
      const staking = getStakingModule(provider, STAKING_MODULE_ADDRESS);

      // Fetch all past ListingVerified events
      const filterEvent = registry.filters.ListingVerified();
      const events = await registry.queryFilter(filterEvent, 0, 'latest');

      const fetched: Listing[] = await Promise.all(
        events.map(async (e) => {
          const seller = e.args?.seller;
          const listingId = e.args?.listingId.toString();
          const metadata = e.args?.metadata;
          const tier = await staking.getTrustTier(seller);
          return {
            listingId,
            seller,
            metadata,
            tier: tier.toNumber(),
            timestamp: e.blockNumber, // simplified; in real use block timestamp
          };
        })
      );

      setListings(fetched);
    };

    loadListings();
  }, []);

  // Filter listings
  const filtered = listings.filter((l) => {
    const keywordMatch = !filter.keyword ||
      l.metadata.toLowerCase().includes(filter.keyword.toLowerCase());
    const tierMatch = !filter.tier || l.tier === parseInt(filter.tier, 10);
    const timeMatch =
      (!filter.startTime || l.timestamp >= parseInt(filter.startTime, 10)) &&
      (!filter.endTime || l.timestamp <= parseInt(filter.endTime, 10));
    return keywordMatch && tierMatch && timeMatch;
  });

  return (
    <div className="app">
      <h1>Nobay Listings</h1>
      <FilterBar filter={filter} setFilter={setFilter} />
      <ListingList listings={filtered} />
    </div>
  );
};

export default App;
