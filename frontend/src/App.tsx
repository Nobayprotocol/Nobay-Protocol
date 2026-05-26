import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPublicClient, custom, formatUnits, http, parseAbiItem } from 'viem';
import './styles.css';

type Listing = {
  listingId: bigint;
  seller: `0x${string}`;
  uri: string;
  timestamp: bigint;
  tier: number;
};

const listingVerified = parseAbiItem(
  'event ListingVerified(uint256 indexed listingId, address indexed seller, string uri, uint256 timestamp)',
);

const stakingAbi = [
  {
    name: 'getTier',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'seller', type: 'address' }],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const;

const tierLabels = ['Unverified', 'Verified', 'Trusted', 'Elite'];

function toIpfsGateway(uri: string) {
  if (uri.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  return uri;
}

async function getProviderClient(rpcUrl: string) {
  const eth = (window as any).ethereum;
  if (eth) return createPublicClient({ transport: custom(eth) });
  return createPublicClient({ transport: http(rpcUrl || undefined) });
}

function App() {
  const [registry, setRegistry] = useState('');
  const [staking, setStaking] = useState('');
  const [rpcUrl, setRpcUrl] = useState('');
  const [fromBlock, setFromBlock] = useState('0');
  const [keyword, setKeyword] = useState('');
  const [tier, setTier] = useState('all');
  const [listings, setListings] = useState<Listing[]>([]);
  const [status, setStatus] = useState('Enter contract addresses, then load listings.');

  async function connectWallet() {
    const eth = (window as any).ethereum;
    if (!eth) return setStatus('No injected wallet found. Using RPC read-only mode.');
    await eth.request({ method: 'eth_requestAccounts' });
    setStatus('Wallet connected.');
  }

  async function loadListings() {
    if (!registry) return setStatus('ListingRegistry address is required.');
    setStatus('Loading ListingVerified events...');
    const client = await getProviderClient(rpcUrl);
    const logs = await client.getLogs({
      address: registry as `0x${string}`,
      event: listingVerified,
      fromBlock: BigInt(fromBlock || '0'),
      toBlock: 'latest',
    });

    const rows = await Promise.all(
      logs.map(async (log) => {
        let trustTier = 0;
        if (staking) {
          trustTier = Number(
            await client.readContract({
              address: staking as `0x${string}`,
              abi: stakingAbi,
              functionName: 'getTier',
              args: [log.args.seller!],
            }),
          );
        }
        return {
          listingId: log.args.listingId!,
          seller: log.args.seller!,
          uri: log.args.uri!,
          timestamp: log.args.timestamp!,
          tier: trustTier,
        } satisfies Listing;
      }),
    );

    setListings(rows.sort((a, b) => Number(b.timestamp - a.timestamp)));
    setStatus(`Loaded ${rows.length} listings.`);
  }

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return listings.filter((item) => {
      const matchesKeyword = !q || item.uri.toLowerCase().includes(q) || item.seller.toLowerCase().includes(q);
      const matchesTier = tier === 'all' || item.tier >= Number(tier);
      return matchesKeyword && matchesTier;
    });
  }, [keyword, listings, tier]);

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Nobay Protocol</p>
        <h1>Listing Discovery</h1>
        <p>Browse verified listings from ListingRegistry events and rank sellers by StakingModule trust tier.</p>
        <button onClick={connectWallet}>Connect wallet</button>
      </section>

      <section className="panel grid">
        <label>ListingRegistry<input value={registry} onChange={(e) => setRegistry(e.target.value)} placeholder="0x..." /></label>
        <label>StakingModule<input value={staking} onChange={(e) => setStaking(e.target.value)} placeholder="0x..." /></label>
        <label>RPC URL<input value={rpcUrl} onChange={(e) => setRpcUrl(e.target.value)} placeholder="optional if wallet injected" /></label>
        <label>From block<input value={fromBlock} onChange={(e) => setFromBlock(e.target.value)} /></label>
        <button className="primary" onClick={loadListings}>Load listings</button>
        <p className="status">{status}</p>
      </section>

      <section className="panel filters">
        <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Filter keyword, seller, URI" />
        <select value={tier} onChange={(e) => setTier(e.target.value)}>
          <option value="all">Any trust tier</option>
          <option value="1">Verified+</option>
          <option value="2">Trusted+</option>
          <option value="3">Elite only</option>
        </select>
      </section>

      <section className="cards">
        {filtered.map((item) => (
          <article className="card" key={item.listingId.toString()}>
            <div className="cardTop">
              <strong>#{item.listingId.toString()}</strong>
              <span className={`tier tier${item.tier}`}>{tierLabels[item.tier] || `Tier ${item.tier}`}</span>
            </div>
            <p className="seller">{item.seller}</p>
            <a href={toIpfsGateway(item.uri)} target="_blank" rel="noreferrer">{item.uri}</a>
            <time>{new Date(Number(item.timestamp) * 1000).toLocaleString()}</time>
          </article>
        ))}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
