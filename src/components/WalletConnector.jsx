import React from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export function WalletConnector() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  if (!isConnected) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-400 mr-2">Connect Wallet:</span>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="hidden sm:block text-right">
        <p className="text-xs text-slate-400">Connected</p>
        <p className="text-sm font-mono text-blue-400">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </p>
      </div>
      <button
        onClick={() => disconnect()}
        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
        title="Disconnect Wallet"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
      </button>
    </div>
  );
}
