import { useState } from 'react';

interface FilterBarProps {
  filters: {
    keyword: string;
    tier: string;
    sortBy: string;
  };
  onFilterChange: (filters: any) => void;
}

export default function FilterBar({ filters, onFilterChange }: FilterBarProps) {
  return (
    <div className="card mb-6">
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search listings..."
            value={filters.keyword}
            onChange={(e) => onFilterChange({ ...filters, keyword: e.target.value })}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-nobay-500"
          />
        </div>
        
        {/* Trust Tier Filter */}
        <div className="w-full md:w-48">
          <select
            value={filters.tier}
            onChange={(e) => onFilterChange({ ...filters, tier: e.target.value })}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-nobay-500"
          >
            <option value="all">All Tiers</option>
            <option value="0">Unverified</option>
            <option value="1">Verified</option>
            <option value="2">Trusted</option>
            <option value="3">Elite</option>
          </select>
        </div>
        
        {/* Sort */}
        <div className="w-full md:w-48">
          <select
            value={filters.sortBy}
            onChange={(e) => onFilterChange({ ...filters, sortBy: e.target.value })}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-nobay-500"
          >
            <option value="timestamp">Newest First</option>
            <option value="timestamp-asc">Oldest First</option>
          </select>
        </div>
      </div>
    </div>
  );
}
