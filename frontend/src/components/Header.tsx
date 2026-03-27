import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function Header() {
  return (
    <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-nobay-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
            N
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Nobay Discovery</h1>
            <p className="text-xs text-slate-400">Decentralized Marketplace</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <nav className="hidden md:flex gap-6 text-slate-300">
            <a href="/" className="hover:text-white transition">Browse</a>
            <a href="/about" className="hover:text-white transition">About</a>
          </nav>
          
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
