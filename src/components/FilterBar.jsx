import React from 'react';

export function FilterBar({ filters, setFilters }) {
  const handleKeywordChange = (e) => {
    setFilters(prev => ({ ...prev, keyword: e.target.value }));
  };

  const handleTierChange = (e) => {
    setFilters(prev => ({ ...prev, tier: parseInt(e.target.value) }));
  };

  const handleSortChange = (e) => {
    setFilters(prev => ({ ...prev, sortBy: e.target.value }));
  };

  return (
    <div className="bg-slate-800 p-4 rounded-xl shadow-lg mb-6 border border-slate-700">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Keyword Search */}
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-400 mb-1">Search Listings</label>
          <input
            type="text"
            placeholder="Search by ID or Seller..."
            value={filters.keyword}
            onChange={handleKeywordChange}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Trust Tier Filter */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Min Trust Tier</label>
          <select
            value={filters.tier}
            onChange={handleTierChange}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value={0}>All Tiers</option>
            <option value={1}>Tier 1+</option>
            <option value={2}>Tier 2+</option>
            <option value={3}>Tier 3+</option>
          </select>
        </div>

        {/* Sort By */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Sort By</label>
          <select
            value={filters.sortBy}
            onChange={handleSortChange}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="tier">Highest Trust Tier</option>
          </select>
        </div>
      </div>
    </div>
  );
}
