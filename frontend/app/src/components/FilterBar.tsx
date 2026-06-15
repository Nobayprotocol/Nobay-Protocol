interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  tierFilter: number | null;
  onTierChange: (tier: number | null) => void;
  showActiveOnly: boolean;
  onActiveOnlyChange: (active: boolean) => void;
  resultCount: number;
  totalCount: number;
}

const TIERS = [
  { value: null, label: 'All Tiers' },
  { value: 0, label: 'Unverified' },
  { value: 1, label: 'Verified' },
  { value: 2, label: 'Trusted' },
  { value: 3, label: 'Elite' },
];

export function FilterBar({
  searchQuery,
  onSearchChange,
  tierFilter,
  onTierChange,
  showActiveOnly,
  onActiveOnlyChange,
  resultCount,
  totalCount,
}: FilterBarProps) {
  return (
    <div className="card mb-6">
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search by URI, seller address, or tier..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="input w-full pl-10"
            />
          </div>
        </div>

        {/* Tier Filter */}
        <div className="flex gap-2">
          <select
            value={tierFilter ?? ''}
            onChange={(e) => onTierChange(e.target.value ? Number(e.target.value) : null)}
            className="input"
          >
            {TIERS.map((tier) => (
              <option key={tier.label} value={tier.value ?? ''}>
                {tier.label}
              </option>
            ))}
          </select>

          {/* Active Only Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showActiveOnly}
              onChange={(e) => onActiveOnlyChange(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-300 whitespace-nowrap">Active only</span>
          </label>
        </div>
      </div>

      {/* Results count */}
      <div className="mt-3 text-xs text-slate-500">
        Showing {resultCount} of {totalCount} listings
      </div>
    </div>
  );
}
