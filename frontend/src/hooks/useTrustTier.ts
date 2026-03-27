import { useContractRead } from 'wagmi';
import { STAKING_MODULE_ABI, CONTRACT_ADDRESSES } from '../lib/contracts';
import { useChainId } from 'wagmi';

export function useTrustTier(sellerAddress: `0x${string}` | undefined) {
  const chainId = useChainId();
  const address = CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES]?.stakingModule;
  
  return useContractRead({
    address,
    abi: STAKING_MODULE_ABI,
    functionName: 'getTier',
    args: sellerAddress ? [sellerAddress] : undefined,
    enabled: !!sellerAddress,
  });
}
