import { useState } from 'react';
import { ethers } from 'ethers';

export default function App() {
  const [wallet, setWallet] = useState('');

  const connectWallet = async () => {
    if ((window as any).ethereum) {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      setWallet(await signer.getAddress());
    }
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Nobay Listing Discovery Engine</h1>
      <button onClick={connectWallet} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
        {wallet ? `Connected: ${wallet.slice(0,6)}...` : 'Connect Wallet'}
      </button>
      
      <div style={{ marginTop: '2rem' }}>
        <h2>Verified Listings</h2>
        <p>Listening for ListingVerified events...</p>
      </div>
    </div>
  );
}
