import { useState, useEffect } from 'react';
import { useTrustTier } from '../hooks/useTrustTier';
import { TIER_NAMES, TIER_COLORS } from '../lib/contracts';

interface ListingCardProps {
  listing: {
    seller: string;
    uri: string;
    timestamp: bigint;
    active: boolean;
  };
  listingId: number;
}

export default function ListingCard({ listing, listingId }: ListingCardProps) {
  const [metadata, setMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const { data: tier } = useTrustTier(listing.seller as `0x${string}`);
  const tierNumber = tier ? Number(tier) : 0;
  
  // Fetch IPFS metadata
  useEffect(() => {
    async function fetchMetadata() {
      try {
        if (listing.uri.startsWith('ipfs://')) {
          const ipfsHash = listing.uri.replace('ipfs://', '');
          const response = await fetch(`https://ipfs.io/ipfs/${ipfsHash}`);
          const data = await response.json();
          setMetadata(data);
        } else {
          // Assume it's already an HTTP URL or direct JSON
          setMetadata({ title: 'Listing', description: listing.uri });
        }
      } catch (error) {
        console.error('Failed to fetch metadata:', error);
        setMetadata({ title: 'Listing #' + listingId, description: 'Unable to load metadata' });
      } finally {
        setLoading(false);
      }
    }
    
    fetchMetadata();
  }, [listing.uri, listingId]);

  const timestamp = new Date(Number(listing.timestamp) * 1000);
  const timeAgo = getTimeAgo(timestamp);

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-40 bg-slate-700 rounded mb-4"></div>
        <div className="h-4 bg-slate-700 rounded mb-2"></div>
        <div className="h-3 bg-slate-700 rounded w-2/3"></div>
      </div>
    );
  }

  return (
    <div className="card hover:border-nobay-500 cursor-pointer transition-all">
      {/* Image or Placeholder */}
      {metadata?.image && (
        <img
          src={metadata.image}
          alt={metadata.title}
          className="w-full h-40 object-cover rounded-lg mb-4"
        />
      )}
      
      {/* Content */}
      <div className="space-y-3">
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-semibold line-clamp-2">
            {metadata?.title || `Listing #${listingId}`}
          </h3>
          <span className={`${TIER_COLORS[tierNumber]} tier-badge`}>
            {TIER_NAMES[tierNumber]}
          </span>
        </div>
        
        <p className="text-slate-400 text-sm line-clamp-2">
          {metadata?.description || 'No description available'}
        </p>
        
        <div className="flex justify-between items-center text-xs text-slate-500">
          <span>{listing.seller.slice(0, 6)}...{listing.seller.slice(-4)}</span>
          <span>{timeAgo}</span>
        </div>
        
        {metadata?.price && (
          <div className="pt-3 border-t border-slate-700">
            <span className="text-nobay-400 font-semibold">
              {metadata.price}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
  
  return date.toLocaleDateString();
}
