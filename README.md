<img width="1019" height="181" alt="image" src="https://github.com/user-attachments/assets/e8701c00-5a47-440d-a0f4-3437b9323910" />

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

## Getting Started

Each part of this repo has its own README with full setup and deployment instructions:

| Part | README |
|---|---|
| Contracts (Solidity + Rust) | [`contracts/README.md`](./contracts/README.md) |
| C++ StabilityEngine | [`contracts/c++/README.md`](./contracts/c++/README.md) |
| Frontend | [`frontend/README.md`](./frontend/README.md) |


---

## Architecture

<img width="1748" height="1239" alt="flowchart_draft2" src="https://github.com/user-attachments/assets/38538727-a6b8-469a-b9ee-98cf1eb4f446" />

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
- ratio 220 → 30 pts | ratio 180 → 20 pts | ratio 150 → 10 pts | ratio 130 → 5 pts

Final score = sum of three components, capped at 100.

| Score | Flag |
|---|---|
| 60 – 100 | `STABLE` |
| 30 – 59 | `CAUTION` |
| 0 – 29 | `AT_RISK` |

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

All deployed on **Polkadot Hub TestNet** (Chain ID: `420420417`)

| Contract | Language | Address |
|---|---|---|
| PolkaDollar (pUSD) | Solidity | `0x876df4BBD21ec38f78D6AEbF9687a89445821BE7` |
| CollateralVault | Solidity | `0x54Dc42542E36F10b5Ff8B60A00cf1e48278006ae` |
| PriceFeed | Solidity | `0xCDe170C92E281757aD961Ba47B33DFacd827a761` |
| RiskEngine | **Rust** | `0x1a5b66d8b4170213696D7a0Ec465fFF165E6ba2B` |
| RiskEngineCaller | Solidity | `0xF11336b3910426e1A4433adA20E19eA73876A306` |
| StabilityEngine | **C++** | `0x0a86C6f085E7De256F44fADb7F39DEB122d8017c` |
| StabilityAnalyzer | Solidity | `0x6B22F224B7534F8cf446212BA2bA0446dFe4cF57` |
| XCMTransfer | Solidity | `0x0bbB5aA6EDc0d7027e9893d405a80E0f47204fED` |

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

### StabilityAnalyzer.sol
Calls the C++ PVM contract. Returns a numeric stability score and a text flag: `STABLE`, `CAUTION`, or `AT_RISK`.

- `analyze(user)` — reads vault state for `user` and scores it
- `analyzeRaw(collateralUSD, debt, volatility, ratio)` — custom parameters

### XCMTransfer.sol
Calls the XCM precompile at `0x000000000000000000000000000000000000A000`.

- `sendCrossChain(dest, message)` — low-level dispatch
- `send(dest, message, address)` — higher-level with recipient

---


## Key Design Decisions

**Why dynamic collateral ratios?**
A fixed ratio is either too tight (undercollateralized during volatility spikes) or too loose (capital inefficient when markets are calm). EWMA on-chain lets the protocol adapt without governance votes or off-chain keepers.

**Why Rust on PVM for the risk model?**
Fixed-point EWMA needs precise arithmetic without floating point. Rust gives deterministic behavior and the ability to use integer math that matches the EVM's execution guarantees. The call happens in the same block as the mint — no oracle lag, no separate keeper transaction.

**Why C++ on PVM for the stability analyzer?**
The multi-factor scoring model maps naturally to C++ value semantics. Like the Rust contract, it compiles to PVM bytecode and uses only integer arithmetic — no floating point, fully deterministic. The `analyzeRaw` entry point accepts the same volatility value returned by the Rust EWMA contract, so both models share a single coherent risk state per transaction.

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
| Polkadot utilities | @polkadot/api, @polkadot/util-crypto |
| Network | Paseo Asset Hub (Polkadot Hub TestNet) |
