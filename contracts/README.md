A collateralized debt protocol on Polkadot Hub (EVM) that lets users deposit DOT, mint a USD-pegged token (pUSD), and send assets cross-chain via XCM. Collateral ratios are computed dynamically by a Rust contract running on PolkaVM — called atomically from Solidity within the same transaction.

---

## What It Does

- **Mint pUSD:** Lock DOT as collateral, borrow a synthetic USD token (ERC-20).
- **Dynamic collateral ratios:** A Rust/PVM contract runs an EWMA volatility model on DOT price history. The collateral ratio adjusts between 130% and 220% depending on market volatility regime.
- **Liquidations:** Any account whose health factor drops below 1.2 can be liquidated. Liquidators receive a 5% bonus.
- **Cross-chain transfers:** pUSD or DOT can be routed to other parachains (Hydration, Acala, Moonbeam, Astar, Bifrost, Interlay) via an XCM precompile.
- **Cross-VM execution:** Solidity contracts call Rust contracts (PVM) and a C++ stability analyzer — all within a single EVM transaction — using Polkadot's pallet-revive.

---

## Problem

ETH-based stablecoin protocols use fixed collateral ratios. During high volatility, a fixed ratio either under-collateralizes the protocol (risk of insolvency) or over-collateralizes it (capital inefficiency). Separately, bridging assets between parachains requires off-chain tooling or relayers. This protocol addresses both: ratio adjustment happens on-chain via a Rust risk model, and cross-chain transfers happen via an EVM precompile.

---

## Solution

| Layer | What it does |
|---|---|
| Solidity (EVM) | User-facing vault, token, price feed, XCM dispatcher |
| Rust (PVM / PolkaVM) | EWMA variance estimator — computes volatility and regime |
| C++ (PVM) | Stability analyzer — scores positions on multiple dimensions |
| pallet-revive | Routes EVM → PVM calls transparently; single atomic tx |
| XCM Precompile | Encodes and dispatches cross-chain messages from EVM |

---

## Architecture

<img width="1748" height="1239" alt="flowchart_draft2" src="https://github.com/user-attachments/assets/3a687911-2095-4ded-9b66-bfc88b609ea4" />

```
User (MetaMask)
    │
    ▼
CollateralVault.sol  ──── reads ────► PriceFeed.sol
    │                                      │
    ├── mint() ──────────────────────────► checks oracle staleness (30 min max)
    │
    ├── calls assessRisk() ─────────────► RiskEngineCaller.sol
    │                                          │
    │                                          └── cross-VM call ──► Rust EWMA contract (PVM)
    │                                                                  returns: regime + ratio
    │
    ├── mint pUSD ──────────────────────► PolkaDollar.sol (ERC-20)
    │
    └── stability check ────────────────► StabilityAnalyzer.sol
                                               │
                                               └── cross-VM call ──► C++ contract (PVM)
                                                                       returns: score + flag

Bridge page:
    User input ─► XCMTransfer.sol ─► XCM Precompile (0xA000) ─► destination parachain
```

### EWMA Risk Model

The Rust contract maintains a running variance estimate:

```
σ²ₜ = λ · σ²ₜ₋₁ + (1 − λ) · r²ₜ
```

- `λ = 0.94` (decay factor)
- `rₜ = ln(Pₜ / Pₜ₋₁)` (log return)

Regimes and collateral ratios:

| Regime | Condition | Collateral Ratio |
|---|---|---|
| LOW | σ < 3.16% | 130% |
| MEDIUM | σ < 6.32% | 155% |
| HIGH | σ < 9.49% | 185% |
| EXTREME | σ ≥ 9.49% | 220% |

### C++ Stability Score Model

The C++ contract computes a composite stability score from three components. All arithmetic is integer-based — no floating point — fully deterministic on PVM.

**Component 1 — Collateralization (0–40 pts)**
- `col_ratio = (totalCollateralUSD × 100) / totalDebt`
- col_ratio ≥ 300% → 40 pts
- col_ratio 120–300% → scaled linearly
- col_ratio < 120% → 0 pts

**Component 2 — Volatility (0–30 pts)**
- volatility input is ×100 (e.g. 5% = 500)
- volatility ≤ 200 (2%) → 30 pts
- volatility ≥ 3000 (30%) → 0 pts
- between → scaled linearly

**Component 3 — Ratio buffer (0–30 pts)**
- ratio 220 → 30 pts
- ratio 180 → 20 pts
- ratio 150 → 10 pts
- ratio 130 → 5 pts

Final score = sum of three components, capped at 100.

Score-to-flag mapping:

| Score Range | Flag | Meaning |
|---|---|---|
| 60 – 100 | `STABLE` | Protocol is well-collateralized; no action needed |
| 30 – 59 | `CAUTION` | Approaching risk boundaries |
| 0 – 29 | `AT_RISK` | Near liquidation threshold; immediate action recommended |

The C++ contract exposes two entry points:
- `analyze(user)` — reads vault state on-chain for a given address and scores it
- `analyzeRaw(collateralUSD, debt, volatility, ratio)` — scores arbitrary parameters directly, used by the frontend risk monitor

Because the score depends on the volatility value emitted by the Rust EWMA contract, the full risk pipeline in a single `mint()` call is:

```
CollateralVault → RiskEngineCaller (Rust/PVM) → StabilityAnalyzer (C++/PVM)
```

Both cross-VM calls are dispatched via `pallet-revive` within the same atomic transaction.

### Health Factor

```
healthFactor = (collateralUSD / collateralRatio) / debt
```

Liquidation triggers when `healthFactor < 1.2`.

### XCM Message Encoding

XCM V4 messages are SCALE-encoded in `xcm.ts`:
1. `WithdrawAsset` — pulls the amount from the caller's sovereign account
2. `BuyExecution` — pays execution fees on the destination chain
3. `DepositAsset` — delivers to the recipient's AccountId32

---

## Contracts

All deployed on **Paseo Asset Hub / Polkadot Hub TestNet** (Chain ID: `420420417`)

| Contract | Address |
|---|---|
| PolkaDollar (pUSD) | `0x876df4BBD21ec38f78D6AEbF9687a89445821BE7` |
| CollateralVault | `0x54Dc42542E36F10b5Ff8B60A00cf1e48278006ae` |
| PriceFeed | `0xCDe170C92E281757aD961Ba47B33DFacd827a761` |
| RiskEngine (Rust/PVM) | `0x1a5b66d8b4170213696D7a0Ec465fFF165E6ba2B` |
| RiskEngineCaller (EVM) | `0xF11336b3910426e1A4433adA20E19eA73876A306` |
| StabilityAnalyzer (C++) | `0x6B22F224B7534F8cf446212BA2bA0446dFe4cF57` |
| StabilityEngine (C++) | `0x0a86C6f085E7De256F44fADb7F39DEB122d8017c` |
| XCMTransfer | `0x0bbB5aA6EDc0d7027e9893d405a80E0f47204fED` |

**Network**

| Parameter | Value |
|---|---|
| RPC | `https://eth-rpc-testnet.polkadot.io/` |
| Chain ID | `420420417` |
| Currency | PAS |
| Explorer | `https://blockscout-testnet.polkadot.io/` |
| XCM Precompile | `0x000000000000000000000000000000000000A000` |

---

## Contract Details

### PolkaDollar.sol
ERC-20 token. Only the registered vault address can call `mint` or `burnFromVault`. Owner can rotate the vault address.

### CollateralVault.sol
Core protocol contract.

- `deposit()` — payable, accepts native DOT as collateral
- `mint(amount)` — mints `amount` pUSD against deposited collateral; calls RiskEngine to get current ratio
- `burn(amount)` — repays debt; caller must have approved vault to spend pUSD
- `withdraw(amount)` — withdraws collateral; reverts if resulting health factor < 1.2
- `liquidate(user)` — liquidates a position; caller gets 105% of the debt value in collateral

### PriceFeed.sol
Owner-only price update. Stores price as 18-decimal fixed point. CollateralVault reads this and reverts if `block.timestamp - lastUpdatedAt > 1800`.

### RiskEngineCaller.sol
Wrapper around the PVM Rust contract. Encodes calldata, dispatches cross-VM, decodes regime and ratio from the response.

- `pushPrice(price)` — feeds a new price point to the EWMA model
- `assessRisk()` — returns `(regime uint8, ratio uint256)`

### XCMTransfer.sol
Calls the XCM precompile at `0x000000000000000000000000000000000000A000`.

- `sendCrossChain(dest, message)` — low-level dispatch
- `send(dest, message, address)` — higher-level with recipient

### StabilityAnalyzer.sol
Calls the C++ PVM contract. Returns a numeric stability score and a text flag: `STABLE`, `CAUTION`, or `AT_RISK`.

- `analyze(user)` — reads vault state for `user` and scores it
- `analyzeRaw(collateralUSD, debt, volatility, ratio)` — custom parameters

---

## Repository Structure

```
Polkadollar/
├── contracts/
│   ├── contracts/
│   │   ├── PolkaDollar.sol          # ERC-20 pUSD token
│   │   ├── CollateralVault.sol      # Core lending logic
│   │   ├── PriceFeed.sol            # Owner-updatable oracle
│   │   ├── RiskEngineCaller.sol     # EVM → Rust (EWMA) bridge
│   │   ├── XCMTransfer.sol          # XCM dispatcher
│   │   ├── MockXCMTransfer.sol      # XCM mock for testing
│   │   └── StabilityAnalyzer.sol   # EVM → C++ (PVM) bridge
│   ├── scripts/
│   │   ├── deploy-backend.ts        # Deploy PriceFeed + pUSD + Vault
│   │   ├── oracle-sync.ts           # Fetch DOT price, push to contracts
│   │   ├── e2e-backend.ts           # End-to-end: deposit → mint → burn → withdraw
│   │   ├── wire-existing-vault.ts   # Link vault to existing pUSD token
│   │   ├── deploy-xcm-transfer.ts   # Deploy XCMTransfer
│   │   ├── xcm-encode.ts            # Generate XCM hex
│   │   ├── send-xcm-direct.ts       # Send XCM via precompile
│   │   └── selectors.ts             # Print function selectors
│   ├── hardhat.config.ts
│   ├── .env                         # Private key, RPC, addresses
│   └── package.json
│
├── cpp-calculator/                  # C++ StabilityEngine (PolkaVM)
│   ├── cpp/
│   │   └── calculator_math.cpp      # Stability scoring logic (pure C++, no stdlib)
│   ├── src/
│   │   └── calculator.rs            # Rust entry point — PolkaVM host function wiring
│   ├── build.rs                     # cc crate compiles C++ during cargo build
│   ├── Cargo.toml
│   ├── rust-toolchain.toml
│   └── .cargo/
│       └── config.toml              # RISC-V target config
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx               # Root layout, fonts, cursor, scroll
│   │   ├── page.tsx                 # Landing page
│   │   └── (protocol)/
│   │       ├── dashboard/page.tsx   # Protocol stats, charts, gauges
│   │       ├── vault/page.tsx       # Deposit, mint, burn, withdraw, liquidate
│   │       ├── bridge/page.tsx      # XCM cross-chain transfer UI
│   │       └── risk-monitor/page.tsx # EWMA volatility, regime, charts
│   ├── components/
│   │   ├── RiskGauge.tsx            # Regime dial visualization
│   │   ├── StabilityGauge.tsx       # C++ stability score visualization
│   │   ├── GlitchMarquee.tsx        # Landing page marquee
│   │   ├── SmoothCursor.tsx         # Custom cursor
│   │   └── SmoothScroll.tsx         # Lenis scroll wrapper
│   ├── hooks/
│   │   └── usePolkadollarBackend.ts # All contract interactions (ethers v6)
│   ├── lib/
│   │   └── xcm.ts                   # XCM SCALE encoding utilities
│   ├── context/
│   │   └── protocol-provider.tsx    # Global state: wallet, position, risk, history
│   ├── .env                         # Contract addresses, chain config
│   └── package.json
│
├── BACKEND.md                       # Backend ops reference
├── FRONTEND_INTEGRATION.md          # Integration guide
└── LICENSE
```

---

## Deploying Contracts

> **Note:** The C++ StabilityEngine (`cpp-calculator/`) has its own separate build and deploy pipeline. See [`cpp-calculator/README.md`](./c++/README.md) for those instructions.

### Prerequisites

- Node.js 20+
- Paseo testnet PAS tokens ([faucet](https://faucet.polkadot.io/))

**1. Install dependencies**

```bash
cd contracts
npm install
```

**2. Configure environment**

Create `contracts/.env`:

```env
PRIVATE_KEY=<your_private_key>
HUB_RPC_URL=https://eth-rpc-testnet.polkadot.io/
COINGECKO_API_KEY=<optional>

# Set after first deploy:
RISK_ENGINE_ADDRESS=0x1a5b66d8b4170213696D7a0Ec465fFF165E6ba2B
PUSD_ADDRESS=0x876df4BBD21ec38f78D6AEbF9687a89445821BE7
VAULT_ADDRESS=0x54Dc42542E36F10b5Ff8B60A00cf1e48278006ae
PRICE_FEED_ADDRESS=0xCDe170C92E281757aD961Ba47B33DFacd827a761
```

**3. Compile**

```bash
npx hardhat compile
```

**4. Deploy**

```bash
# Deploy PriceFeed, pUSD token, CollateralVault
npx hardhat run scripts/deploy-backend.ts --network hub

# Deploy XCM transfer contract
npx hardhat run scripts/deploy-xcm-transfer.ts --network hub
```

**5. Sync oracle**

```bash
# Push current DOT price from CoinGecko to PriceFeed and RiskEngine
npx hardhat run scripts/oracle-sync.ts --network hub

# Run continuously every 5 minutes
ORACLE_ONCE=false ORACLE_INTERVAL_SECONDS=300 npx hardhat run scripts/oracle-sync.ts --network hub
```

**6. Run end-to-end test**

```bash
npx hardhat run scripts/e2e-backend.ts --network hub
```

Expected output:
```
Deposited 1 DOT
Minted X pUSD (auto-computed from regime ratio)
Burned 0.5 pUSD
Withdrew 0.1 DOT
Final health factor: OK
```

---

## Key Design Decisions

**Why dynamic collateral ratios?**
A fixed ratio is either too tight (undercollateralized during volatility spikes) or too loose (capital inefficient when markets are calm). EWMA on-chain lets the protocol adapt without governance votes or off-chain keepers.

**Why Rust on PVM for the risk model?**
Fixed-point EWMA needs precise arithmetic without floating point. Rust gives deterministic behavior and the ability to use integer math that matches the EVM's execution guarantees. The call happens in the same block as the mint — no oracle lag, no separate keeper transaction.

**Why C++ on PVM for the stability analyzer?**
The multi-dimensional scoring model involves several parallel weighted computations that map naturally to C++ value semantics. Like the Rust contract, the C++ contract compiles to PVM bytecode and uses only integer arithmetic (scaled by 1e6) — no floating point, fully deterministic. The `analyzeRaw` entry point accepts the same volatility value returned by the Rust EWMA contract, so both models share a single coherent risk state per transaction.

**Why pallet-revive instead of a precompile?**
pallet-revive transparently routes EVM calls to PVM contracts. The Solidity code uses a normal external call — no custom ABI encoding at the call site. The routing is handled at the runtime level.

**Why the XCM precompile instead of a pallet?**
An EVM precompile at `0xA000` lets the frontend trigger cross-chain sends from MetaMask without requiring a Substrate wallet or polkadot.js. The XCM message is SCALE-encoded in TypeScript (`xcm.ts`) and passed as bytes.

**Oracle architecture**
PriceFeed is intentionally simple: owner-controlled, no TWAP. The oracle-sync script runs off-chain and pushes prices. The vault enforces a 30-minute staleness check. For production, this would be replaced with a decentralized oracle.

---

## Security Notes

- Private key in `.env` is a testnet-only key used for demonstrations. Do not fund it on mainnet.
- The `setVault` function on PolkaDollar is owner-controlled. Rotation requires a governance mechanism for production use.
- Liquidation bonus is hardcoded at 5%. No auction mechanism — first caller wins.
- Oracle is centralized (single owner). Staleness check is the only protection against a stale price.

---

## Tech Stack

| Component | Stack |
|---|---|
| Smart contracts | Solidity 0.8.28, Hardhat, OpenZeppelin 5 |
| Risk model | Rust (compiled to PVM / PolkaVM bytecode) |
| Stability analyzer | C++ (compiled to PVM bytecode) |
| Cross-VM runtime | Polkadot pallet-revive |
| Frontend | Next.js 16, React 19, TypeScript |
| Contract interaction | ethers.js v6 |
| UI | Tailwind CSS, Radix UI, Recharts, Framer Motion |
| Scroll | Lenis |
| Polkadot utilities | @polkadot/api, @polkadot/util-crypto |
| Network | Paseo Asset Hub (Polkadot Hub TestNet) |
