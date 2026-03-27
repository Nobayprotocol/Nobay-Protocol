import { useContractRead, useContractReads } from 'wagmi';
import { LISTING_REGISTRY_ABI, CONTRACT_ADDRESSES } from '../lib/contracts';
import { useChainId } from 'wagmi';

export function useListingCount() {
  const chainId = useChainId();
  const address = CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES]?.listingRegistry;
  
  return useContractRead({
    address,
    abi: LISTING_REGISTRY_ABI,
    functionName: 'listingCount',
  });
}

export function useListing(listingId: number) {
  const chainId = useChainId();
  const address = CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES]?.listingRegistry;
  
  return useContractRead({
    address,
    abi: LISTING_REGISTRY_ABI,
    functionName: 'listings',
    args: [listingId],
  });
}

export function useListings(startId: number, count: number) {
  const chainId = useChainId();
  const address = CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES]?.listingRegistry;
  
  // Generate array of listing IDs to fetch
  const listingIds = Array.from({ length: count }, (_, i) => startId + i);
  
  return useContractReads({
    contracts: listingIds.map(id => ({
      address,
      abi: LISTING_REGISTRY_ABI,
      functionName: 'listings',
      args: [id],
    })),
  });
}
