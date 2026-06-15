import { Listing } from '../hooks/useListings';
import { TrustBadge } from './TrustBadge';

interface ListingGridProps {
  listings: Listing[];
  onRefresh: () => void;
}

export function ListingGrid({ listings, onRefresh }: ListingGridProps) {
  if (listings.length === 0) {
    return null; // Empty state handled in App
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">
          Listings
          <span className="text-sm text-slate-400 ml-2">
            ({listings.length} {listings.length === 1 ? 'result' : 'results'})
          </span>
        </h2>
        <button
          onClick={onRefresh}
          className="btn-secondary text-sm flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {listings.map((listing) => (
          <div key={listing.id} className="card hover:border-slate-600 transition-all hover:shadow-lg hover:shadow-blue-500/5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-xs font-bold text-white">
                  {listing.seller.slice(2, 4).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-mono text-slate-300">
                    {listing.seller.slice(0, 10)}...{listing.seller.slice(-4)}
                  </p>
                </div>
              </div>
              <TrustBadge
                tier={listing.trustTier}
                label={listing.trustLabel}
                color={listing.trustColor}
              />
            </div>

            <div className="mb-3 p-2 bg-slate-900/50 rounded-lg">
              <p className="text-sm text-slate-300 break-all font-mono text-xs">
                {listing.uri}
              </p>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">
                #{listing.id} • {formatDate(listing.timestamp)}
              </span>
              {listing.active ? (
                <span className="badge badge-green">Active</span>
              ) : (
                <span className="badge badge-gray">Revoked</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
