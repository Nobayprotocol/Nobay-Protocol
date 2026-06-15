import { useState, useEffect } from 'react';

interface ConnectWalletProps {
  onConnect?: (address: string) => void;
}

export function ConnectWallet({ onConnect }: ConnectWalletProps) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    // Check if already connected
    if (window.ethereum) {
      window.ethereum.request({ method: 'eth_accounts' })
        .then((accounts: string[]) => {
          if (accounts.length > 0) {
            setAddress(accounts[0]);
            onConnect?.(accounts[0]);
          }
        })
        .catch(() => {});

      // Listen for account changes
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length > 0) {
          setAddress(accounts[0]);
          onConnect?.(accounts[0]);
        } else {
          setAddress(null);
        }
      });
    }
  }, [onConnect]);

  const connect = async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask or another Web3 wallet');
      return;
    }

    setConnecting(true);
    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });
      setAddress(accounts[0]);
      onConnect?.(accounts[0]);
    } catch (err: any) {
      console.error('Connection failed:', err);
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = () => {
    setAddress(null);
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (address) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
        <span className="text-sm text-slate-300 font-mono">
          {truncateAddress(address)}
        </span>
        <button
          onClick={disconnect}
          className="text-xs text-slate-400 hover:text-white transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={connecting}
      className="btn-primary text-sm"
    >
      {connecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
}

// Declare window.ethereum for TypeScript
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: (...args: any[]) => void) => void;
      removeListener: (event: string, callback: (...args: any[]) => void) => void;
    };
  }
}
