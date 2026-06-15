// Contract ABIs for Nobay Protocol

export const LISTING_REGISTRY_ABI = [
  // Events
  "event ListingVerified(uint256 indexed listingId, address indexed seller, string uri, uint256 timestamp)",
  "event ListingRevoked(uint256 indexed listingId, address indexed seller, uint256 timestamp)",
  
  // View functions
  "function listings(uint256) view returns (address seller, string uri, uint256 timestamp, bool active)",
  "function listingCount() view returns (uint256)",
  "function DOMAIN_SEPARATOR() view returns (bytes32)",
  "function TYPEHASH() view returns (bytes32)",
  
  // Write functions
  "function submitListingWithSig(address seller, string uri, uint256 timestamp, bytes signature) returns (uint256)",
  "function revokeListing(uint256 listingId)",
  "function forceRevoke(uint256 listingId)",
];

export const STAKING_MODULE_ABI = [
  // Events
  "event Staked(address indexed seller, uint256 amount, uint256 timestamp)",
  "event Unstaked(address indexed seller, uint256 amount, uint256 timestamp)",
  
  // View functions
  "function stakes(address) view returns (uint256 amount, uint256 timestamp, bool active)",
  "function getTier(address seller) view returns (uint8)",
  "function cooldownPeriod() view returns (uint256)",
  
  // Write functions
  "function stake(uint256 amount)",
  "function unstake()",
  "function setCooldown(uint256 newCooldown)",
];

export const SLASHING_MODULE_ABI = [
  // Events
  "event Slashed(uint256 indexed slashId, address indexed seller, uint256 amount, uint8 reason, uint256 timestamp, address indexed slashedBy)",
  "event SlasherUpdated(address indexed oldSlasher, address indexed newSlasher)",
  "event StakingModuleUpdated(address indexed oldModule, address indexed newModule)",
  
  // View functions
  "function slashRecords(uint256) view returns (address seller, uint256 amount, uint8 reason, uint256 timestamp, address slashedBy)",
  "function slashCount() view returns (uint256)",
  "function totalSlashed(address) view returns (uint256)",
  "function stakingModule() view returns (address)",
  "function slasher() view returns (address)",
  "function maxSlashBps() view returns (uint256)",
  "function getStake(address seller) view returns (uint256)",
  "function getTier(address seller) view returns (uint8)",
  "function isSlashed(address seller) view returns (bool)",
  
  // Write functions
  "function slash(address seller, uint256 amount, uint8 reason) returns (uint256)",
  "function batchSlash(address[] sellers, uint256[] amounts, uint8 reason) returns (uint256[])",
  "function setSlasher(address newSlasher)",
  "function setStakingModule(address newStakingModule)",
  "function setMaxSlashBps(uint256 newMaxBps)",
  "function recoverSlashedTokens(address to, uint256 amount)",
];

// Trust tier labels and colors
export const TRUST_TIERS = [
  { label: "Unverified", color: "gray", minStake: 0 },
  { label: "Verified", color: "blue", minStake: 1000 },
  { label: "Trusted", color: "green", minStake: 10000 },
  { label: "Elite", color: "purple", minStake: 100000 },
];

// Slash reason labels
export const SLASH_REASONS: Record<number, string> = {
  1: "Fraud",
  2: "Dispute Loss",
  3: "Governance Vote",
};
