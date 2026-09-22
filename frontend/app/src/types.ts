export interface Listing {
  listingId: string;
  seller: string;
  metadata: string;
  tier: number;
  timestamp: number;
}

export interface FilterState {
  keyword: string;
  tier: string;
  startTime: string;
  endTime: string;
}
