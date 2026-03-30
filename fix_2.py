// src/components/Listing.js
import React from 'react';

const Listing = ({ listing }) => {
  return (
    <div className="listing">
      <h3>{listing.title}</h3>
      <p>{listing.description}</p> {/* Added missing closing tag */}
      <p>Trust Tier: {listing.trustTier}</p>
      <p>Timestamp: {new Date(listing.timestamp * 1000).toLocaleString()}</p>
    </div>
  );
};

export default Listing;