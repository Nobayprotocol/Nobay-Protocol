import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Routes, Route } from 'react-router-dom';
import ListingBrowser from './components/ListingBrowser';
import Header from './components/Header';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-nobay-900">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<ListingBrowser />} />
        </Routes>
      </main>
      <footer className="border-t border-slate-700 py-6 text-center text-slate-400">
        <p>Nobay Protocol - Decentralized Marketplace Infrastructure</p>
      </footer>
    </div>
  );
}

export default App;
