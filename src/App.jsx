import React from 'react';
import { WagmiConfig } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WalletConnector } from './components/WalletConnector';
import { DiscoveryEngine } from './components/DiscoveryEngine';

// Configure wagmi provider
const config = {
  chains: [import.meta.env.VITE_CHAIN_ID === '8453' ? import('viem/chains').then(m => m.base) : import('viem/chains').then(m => m.mainnet)], // Default to Base if env var set, else Mainnet
  transports: {
    [import.meta.env.VITE_CHAIN_ID || '1']: import('viem/httpTransport'),
  },
};

// Initialize query client
const queryClient = new QueryClient();

function App() {
  return (
    <WagmiConfig config={config}>
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen bg-slate-900 text-slate-100">
          <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                Nobay Discovery Engine
              </h1>
              <WalletConnector />
            </div>
          </header>
          
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <DiscoveryEngine />
          </main>
        </div>
      </QueryClientProvider>
    </WagmiConfig>
  );
}

export default App;
