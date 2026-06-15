import { TRUST_TIERS } from '../contracts/abi';
import { Listing } from '../hooks/useListings';

interface TrustBadgeProps {
  tier: number;
  label: string;
  color: string;
}

export function TrustBadge({ tier, label, color }: TrustBadgeProps) {
  const colorClass = `badge-${color}`;
  return (
    <span className={`badge ${colorClass}`}>
      {label}
    </span>
  );
}

interface ListingCardProps {
  listing: Listing;
}

export function ListingCard({ listing }: ListingCardProps) {
  const date = new Date(listing.timestamp * 1000);
  const timeAgo = getTimeAgo(date);

  return (
    <div className="card hover:border-slate-600 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-xs font-mono">
            {listing.seller.slice(2, 4).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-mono text-slate-300">
              {listing.seller.slice(0, 6)}...{listing.seller.slice(-4)}
            </p>
            <p className="text-xs text-slate-500">{timeAgo}</p>
          </div>
        </div>
        <TrustBadge
          tier={listing.trustTier}
          label={listing.trustLabel}
          color={listing.trustColor}
        />
      </div>

      <div className="mb-3">
        <p className="text-sm text-slate-300 break-all font-mono">
          {listing.uri}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">
          Listing #{listing.id}
        </span>
        {listing.active ? (
          <span className="badge badge-green">Active</span>
        ) : (
          <span className="badge badge-gray">Revoked</span>
        )}
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
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
