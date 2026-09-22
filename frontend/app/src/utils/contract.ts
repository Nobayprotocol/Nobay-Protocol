import { ethers } from 'ethers';
import ListingRegistryAbi from '../../abis/ListingRegistry.json';
import StakingModuleAbi from '../../abis/StakingModule.json';

export const getListingRegistry = (
  provider: ethers.providers.Provider,
  address: string
) => {
  return new ethers.Contract(address, ListingRegistryAbi, provider);
};

export const getStakingModule = (
  provider: ethers.providers.Provider,
  address: string
) => {
  return new ethers.Contract(address, StakingModuleAbi, provider);
};
