# Nobay Protocol Architecture

**Nobay** is a modular protocol for decentralized marketplaces. It abstracts the core primitives of listing, trust, dispute resolution, and governance into smart contract modules designed to be deployed permissionlessly and governed transparently.

The architecture prioritizes neutrality, forkability, and composability — enabling builders to launch sovereign marketplaces, not applications bound by platform terms or gatekeeping.

---

## 1. Design Philosophy

Modern marketplaces are dominated by centralized custodians. They control who can list, what is visible, and how reputation is quantified. Nobay replaces those intermediaries with protocol-defined coordination rules that any interface or region can adopt.

Key principles:
- **No platform lock-in**  
- **Credibility via collateral**  
- **Forks are ecosystem growth**  
- **Separation of listing, trust, and discovery**

---

## 2. Protocol Layers

### 2.1 Listing Layer

The listing layer handles the registration and retrieval of items for sale. It separates storage from state:

- **Metadata** is signed by the seller and hosted on IPFS/Arweave  
- **On-chain registry** stores references (hash, URI) and seller address  
- **Timestamps, price tokens, and visibility boosts** are tracked on-chain  

This enables frontends to independently interpret, filter, and rank listings without hardcoded logic.

---

### 2.2 Trust Layer

Nobay enforces trust using economic stake — not platform reviews.

- **Sellers stake $NOBAY** to access higher tiers of visibility or reputation  
- **Fulfillment data and disputes** feed into an on-chain scoring system  
- **Slashing and non-fulfillment** degrade trust tiers automatically  

Trust is programmable, publicly auditable, and portable across forks.

---

### 2.3 Escrow & Dispute Resolution

Every transaction can use bonded escrow and optional arbitration modules:

- **Escrow** locks funds until delivery or timeout  
- **Disputes** are initiated by slashing a stake  
- **Arbitrators** are modular — can be DAO-curated, algorithmic, or third-party courts  

Escrow and dispute logic are opt-in at the contract level, not forced globally.

---

### 2.4 Governance Layer

Protocol parameters — emissions, slashing ratio, court registry, etc. — are governed via:

- **Multisig (Phase I)** for initial deployments  
- **Token-weighted DAO (Phase II)** after decentralization  
- **Snapshot + on-chain vote** for executable proposals  
- **Timelocks** ensure delayed upgrade enforcement

Forks may implement alternate governance paths or freeze their rule sets entirely.

---

## 3. Forkability & Composability

Forks are not side effects — they’re core to the design.

- **Regional forks** may use fiat onramps, custom UIs, and local tokens  
- **Vertical forks** (e.g., music equipment, freelance, domain names) can hardcode asset types  
- **Governance forks** may choose alternate dispute resolution, visibility logic, or trust tiers

Every contract is MIT licensed and interface-neutral.

---

## 4. Deployment Context

Initial deployment targets **Base L2**, selected for:
- Low gas fees  
- EVM compatibility  
- Native support for Ethereum tooling  
- Builder ecosystem aligned with decentralization

Future compatible chains may include Optimism, Arbitrum, Zora, Scroll, or even L1 settlement.

---

## 5. Guarantees

| Property | Guarantee |
|----------|-----------|
| **Listing Censorship** | Protocol cannot remove a listing |
| **Trust Evaluation** | Based on public stake + fulfillment, not reviews |
| **Governance Evolution** | All parameters are transparently upgradable |
| **Interface Independence** | Any frontend can query listings and trust data |
| **Permissionless Forks** | Full contract and frontend MIT-licensed |

---

## 6. Future Modules (Open R&D)

- **Delivery Oracle**: For verifying physical product drop-offs  
- **Reputation Curves**: For diminishing returns or tier decay  
- **Batch Dispute Pools**: For class-action resolution or spam mitigation  
- **On-chain Discovery Engines**: Filter + rank feeds without centralized APIs

These may be implemented natively or offered as open plugins by community contributors.

---

Nobay is not a marketplace.  
It’s the protocol that makes marketplaces sovereign again.
