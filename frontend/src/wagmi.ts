import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, polygon, optimism, arbitrum } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Nobay Discovery Engine',
  projectId: 'YOUR_PROJECT_ID', // Replace with WalletConnect project ID
  chains: [mainnet, polygon, optimism, arbitrum],
  ssr: false,
});
