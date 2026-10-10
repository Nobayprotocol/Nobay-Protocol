import React from 'react';

const getTierColor = (tier) => {
  switch (tier) {
    case 3: return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
    case 2: return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
    case 1: return 'text-green-400 bg-green-400/10 border-green-400/20';
    default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
  }
};

const getTierLabel = (tier) => {
  switch (tier) {
    case 3: return 'Elite';
    case 2: return 'Pro';
    case 1: return 'Verified';
    default: return 'Unverified';
  }
};

export function ListingCard({ listing }) {
  const date = new Date(listing.timestamp * 1000).toLocaleDateString();
  
  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 hover:border-blue-500/50 transition-all duration-200 group">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-bold text-lg text-white group-hover:text-blue-400 transition-colors">
            Listing #{listing.id}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Seller: <span className="font-mono">{listing.seller.slice(0, 6)}...{listing.seller.slice(-4)}</span>
          </p>
        </div>
        <div className={`px-2 py-1 rounded-md text-xs font-bold border ${getTierColor(listing.trustTier ?? 0)}`}>
          {getTierLabel(listing.trustTier ?? 0)}
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-slate-700/50 flex justify-between items-center">
        <span className="text-xs text-slate-500">{date}</span>
        <button className="text-sm text-blue-400 hover:text-blue-300 font-medium">
          View Details &rarr;
        </button>
      </div>
    </div>
  );
}
