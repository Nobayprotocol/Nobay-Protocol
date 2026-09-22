import React from 'react';
import { Listing } from '../types';

interface Props {
  listings: Listing[];
}

const ListingList: React.FC<Props> = ({ listings }) => {
  if (!listings.length) {
    return <p>No listings found.</p>;
  }

  return (
    <ul className="listing-list">
      {listings.map((l) => (
        <li key={l.listingId} className="listing-item">
          <h3>Listing #{l.listingId}</h3>
          <p><strong>Seller:</strong> {l.seller}</p>
          <p><strong>Metadata:</strong> {l.metadata}</p>
          <p><strong>Trust Tier:</strong> {l.tier}</p>
          <p><strong>Timestamp:</strong> {l.timestamp}</p>
        </li>
      ))}
    </ul>
  );
};

export default ListingList;
