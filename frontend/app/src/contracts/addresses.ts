// Deployed contract addresses per network
// Update these after deployment

export const CONTRACT_ADDRESSES: Record<number, {
  listingRegistry: string;
  stakingModule: string;
  slashingModule: string;
  nobayToken: string;
}> = {
  // Base Mainnet
  8453: {
    listingRegistry: "0x0000000000000000000000000000000000000000",
    stakingModule: "0x0000000000000000000000000000000000000000",
    slashingModule: "0x0000000000000000000000000000000000000000",
    nobayToken: "0x0000000000000000000000000000000000000000",
  },
  // Base Sepolia Testnet
  84532: {
    listingRegistry: "0x0000000000000000000000000000000000000000",
    stakingModule: "0x0000000000000000000000000000000000000000",
    slashingModule: "0x0000000000000000000000000000000000000000",
    nobayToken: "0x0000000000000000000000000000000000000000",
  },
  // Hardhat Local
  31337: {
    listingRegistry: "0x0000000000000000000000000000000000000000",
    stakingModule: "0x0000000000000000000000000000000000000000",
    slashingModule: "0x0000000000000000000000000000000000000000",
    nobayToken: "0x0000000000000000000000000000000000000000",
  },
};

export function getContractAddresses(chainId: number) {
  return CONTRACT_ADDRESSES[chainId] || CONTRACT_ADDRESSES[31337];
}
