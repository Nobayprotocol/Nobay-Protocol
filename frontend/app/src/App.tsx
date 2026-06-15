import { useState } from 'react';
import { ConnectWallet } from './components/ConnectWallet';
import { ListingGrid } from './components/ListingGrid';
import { FilterBar } from './components/FilterBar';
import { useListings, Listing } from './hooks/useListings';

function App() {
  const { listings, loading, error, chainId, refresh } = useListings();
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<number | null>(null);
  const [showActiveOnly, setShowActiveOnly] = useState(true);

  // Filter listings
  const filteredListings = listings.filter((listing: Listing) => {
    if (showActiveOnly && !listing.active) return false;
    if (tierFilter !== null && listing.trustTier !== tierFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        listing.uri.toLowerCase().includes(q) ||
        listing.seller.toLowerCase().includes(q) ||
        listing.trustLabel.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white">
              N
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Nobay Protocol</h1>
              <p className="text-xs text-slate-400">Listing Discovery Engine</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {chainId && (
              <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded">
                Chain: {chainId}
              </span>
            )}
            <ConnectWallet />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="card">
            <p className="text-xs text-slate-400">Total Listings</p>
            <p className="text-2xl font-bold text-white">{listings.length}</p>
          </div>
          <div className="card">
            <p className="text-xs text-slate-400">Active</p>
            <p className="text-2xl font-bold text-green-400">
              {listings.filter(l => l.active).length}
            </p>
          </div>
          <div className="card">
            <p className="text-xs text-slate-400">Unique Sellers</p>
            <p className="text-2xl font-bold text-blue-400">
              {new Set(listings.map(l => l.seller)).size}
            </p>
          </div>
          <div className="card">
            <p className="text-xs text-slate-400">Elite Sellers</p>
            <p className="text-2xl font-bold text-purple-400">
              {listings.filter(l => l.trustTier === 3).length}
            </p>
          </div>
        </div>

        {/* Filters */}
        <FilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          tierFilter={tierFilter}
          onTierChange={setTierFilter}
          showActiveOnly={showActiveOnly}
          onActiveOnlyChange={setShowActiveOnly}
          resultCount={filteredListings.length}
          totalCount={listings.length}
        />

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-xl">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-slate-400">Loading listings...</span>
          </div>
        )}

        {/* Listings Grid */}
        {!loading && !error && (
          <ListingGrid listings={filteredListings} onRefresh={refresh} />
        )}

        {/* Empty State */}
        {!loading && !error && filteredListings.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-xl font-medium text-white mb-2">No listings found</h3>
            <p className="text-slate-400">
              {listings.length === 0
                ? 'No listings have been submitted yet. Be the first!'
                : 'Try adjusting your filters to see more results.'}
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-500">
          <p>Nobay Protocol — Decentralized marketplace infrastructure</p>
          <p className="mt-1">Forkable. Composable. Sovereign.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
