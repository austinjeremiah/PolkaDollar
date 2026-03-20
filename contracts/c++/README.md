# PolkaDollar — C++ Stability Engine

> A C++ smart contract deployed on Polkadot Hub (Passet Hub) via PolkaVM.  
> Called by Solidity as part of the PolkaDollar lending protocol.

---

## What This Is

This is the **Stability Engine** — a smart contract written in C++ that computes a real-time protocol health score for the PolkaDollar lending protocol.

It is one of the first C++ contracts ever deployed on Polkadot Hub. It runs on PolkaVM alongside Solidity (EVM) and Rust (PVM) contracts, demonstrating true cross-language smart contract execution on the same chain.
<img width="442" height="1060" alt="c++_flowchart" src="https://github.com/user-attachments/assets/ced7a29d-40cd-447e-b66f-43e3d6c0c5ec" />


### What It Computes

Given four inputs from the live protocol:

| Input | Description |
|---|---|
| `totalCollateralUSD` | Total DOT locked in vault × current price |
| `totalDebt` | Total pUSD minted |
| `volatility` | EWMA volatility proxy from Rust RiskEngine |
| `currentRatio` | Active collateral ratio (130 / 150 / 180 / 220) |

It returns two outputs:

| Output | Description |
|---|---|
| `score` | Protocol health score, 0–100 |
| `flag` | `0` = STABLE, `1` = CAUTION, `2` = AT_RISK |

### Scoring Logic (inside C++)

The score is built from three components:

- **Collateralization (0–40 pts)** — how well total collateral covers total debt
- **Volatility (0–30 pts)** — lower volatility earns more points
- **Ratio buffer (0–30 pts)** — higher collateral ratio = more safety buffer

---

## Architecture

```
StabilityAnalyzer.sol  (Solidity — EVM)
        │
        │  reads live data from:
        │  ├── CollateralVault.sol
        │  ├── PriceFeed.sol
        │  └── RiskEngine (Rust — PVM)
        │
        │  cross-language call
        ▼
StabilityEngine  (C++ — PolkaVM)
        │
        │  pure math, no stdlib
        │  C++ compiled to RISC-V
        ▼
   score + flag
```

Three languages. One transaction. One chain.

---

## Deployed Contracts

| Contract | Address |
|---|---|
| Stability Engine (C++) | `0x0a86C6f085E7De256F44fADb7F39DEB122d8017c` |
| Stability Analyzer (Solidity) | `0x6B22F224B7534F8cf446212BA2bA0446dFe4cF57` |

Network: **Passet Hub Testnet**  
RPC: `https://eth-rpc-testnet.polkadot.io/`  
Chain ID: `420420417`

---

## Project Structure

```
cpp-calculator/
├── cpp/
│   └── calculator_math.cpp   ← C++ math (pure computation, no stdlib)
├── src/
│   └── calculator.rs         ← Rust entry point (host function wiring)
├── build.rs                  ← cc crate compiles C++ during cargo build
├── Cargo.toml
├── rust-toolchain.toml
└── .cargo/
    └── config.toml           ← RISC-V target config
```

---

## How It Works

PolkaVM only supports host function calls (reading input, returning output) from Rust via `pallet-revive-uapi`. Pure C++ cannot resolve these symbols at link time.

The solution:

- **C++ handles math** — `calculator_math.cpp` is pure computation with no host calls
- **Rust handles I/O** — `calculator.rs` reads calldata, calls C++ via FFI, returns result
- **`build.rs`** compiles C++ with `clang++-19` targeting `riscv64emac` and links it as a static library into the Rust binary

This is the same pattern the pallet-revive team describes: *"Rust for the runtime layer, C++ for the heavy lifting."*

---

## Prerequisites

```bash
# Rust nightly toolchain
rustup install nightly-2024-11-19
rustup component add rust-src --toolchain nightly-2024-11-19

# clang with RISC-V target
sudo apt install clang-19 lld-19

# polkatool
cargo install polkatool

# cast (Foundry)
curl -L https://foundry.paradigm.xyz | bash && foundryup
```

---

## Build

```bash
cd cpp-calculator

cargo +nightly-2024-11-19 build --release
```

This compiles both C++ and Rust targeting `riscv64emac-unknown-none-polkavm`.

---

## Link

```bash
polkatool link \
    target/riscv64emac-unknown-none-polkavm/release/calculator \
    --output calculator.polkavm

polkatool stats calculator.polkavm
```

---

## Deploy

```bash
export ETH_RPC_URL="https://eth-rpc-testnet.polkadot.io/"

CPP_ADDRESS=$(cast send \
    --private-key YOUR_PRIVATE_KEY \
    --create "0x$(xxd -p -c 99999 calculator.polkavm)" \
    --json | jq -r .contractAddress)

echo "Deployed at: $CPP_ADDRESS"
```

---

## Test

```bash
# analyzeRaw(collateralUSD, debt, volatility, ratio)
cast call $CPP_ADDRESS \
    "call(uint64,uint64,uint64,uint64)(uint64,uint64)" \
    10000 5000 700 150 \
    --rpc-url https://eth-rpc-testnet.polkadot.io/
```

Expected: `score` ~45, `flag` 1 (CAUTION)

---

## Calling from Solidity

```solidity
interface IStabilityEngine {
    function call(
        uint64 totalCollateralUSD,
        uint64 totalDebt,
        uint64 volatility,
        uint64 currentRatio
    ) external returns (uint64 score, uint64 flag);
}

// Cross-language call — Solidity → C++
(uint64 score, uint64 flag) = IStabilityEngine(CPP_ADDRESS).call(
    collateralUSD,
    debt,
    volatility,
    ratio
);
```

See `StabilityAnalyzer.sol` for the full integration.

---

## Why C++?

The EVM (and Solidity) cannot efficiently run iterative statistical math — no floating point, expensive loops, no libraries. Rust handles this for the EWMA volatility engine. C++ handles the multi-factor scoring logic.

Both run natively on PolkaVM as RISC-V bytecode. Both are called by Solidity in the same transaction. No oracle. No off-chain computation. No trust assumption.

---

## Track

Built for **Polkadot Hackathon — Track 2: PVM Smart Contracts**  
Category: *PVM-experiments — Call Rust or C++ libraries from Solidity*
