# Demo 03 — EVM Solidity Calls Rust PVM for Heavy Computation

> **Presentation:** Calling Solidity Contracts from Rust
> **Demo slot:** Demo 3 of 3 — the payoff

## What This Shows

An EVM Solidity contract (`FibCaller.sol`) delegating Fibonacci computation
to a Rust PVM contract (`fibonacci`). This is PVM earning its place:
computation that would be prohibitively expensive in EVM runs as a tight
RISC-V loop in the PVM executor.

```
FibCaller.sol (EVM)               fibonacci (PVM / Rust)
  computeFib(50)    ──────────→   fib(50)
  emits FibResult   ←─────────    = 12,586,269,025
```

**The cross-VM call:**
```solidity
// Inside FibCaller.sol — running in EVM executor
result = IFibonacci(fibContractAddress).fib(50);
// fibContractAddress is a PVM (Rust) contract
// pallet-revive routes this call to the PVM executor
```

## Prerequisites

### Rust toolchain

```bash
rustup install nightly
rustup target add riscv32emac-unknown-none-elf --toolchain nightly
```

### Node + Hardhat

```bash
npm install
cp .env.example .env   # add PRIVATE_KEY
```

## Build & Run

```bash
# All in one
npm run demo:all

# Step by step
npm run build:rust   # compile fibonacci Rust contract → RISC-V
npm run compile      # compile FibCaller.sol → EVM
npm run demo         # deploy both + run cross-VM calls
```

## Expected Output

```
────────────────────────────────────────────────────────
  Demo 03 — EVM Calls PVM for Heavy Computation
────────────────────────────────────────────────────────

  [1] Deploying Fibonacci (Rust → RISC-V → PVM)...
      Fibonacci (PVM Rust) @ 0x1234...

  [2] Deploying FibCaller.sol (Solidity → EVM)...
      FibCaller (EVM Solidity) @ 0xABCD...

  Architecture:
    FibCaller.sol [EVM]
      └─ IFibonacci(0x1234...).fib(n)
           └─ fibonacci [PVM / Rust]

  [3] computeFib(10)...
      fib(10) = 55  ✓

  [4] computeFib(50)...
      fib(50) = 12586269025  ✓

  ✓  EVM FibCaller delegated computation to PVM Fibonacci.
```

## Why Fibonacci?

- `fib(50)` = 12,586,269,025 — audience can verify on their phone
- Iterative EVM loop at `n=50`: thousands of gas per iteration, impractical at scale
- Rust RISC-V loop: minimal overhead, constant memory usage (O(1) space)
- Simple function signature: `fib(uint256 n) returns (uint256)`

## Network

| Property | Value |
|----------|-------|
| Chain ID | 420420417 |
| Currency | PAS |
| RPC | https://eth-rpc-testnet.polkadot.io/ |
| Faucet | https://faucet.polkadot.io → Polkadot Hub TestNet |
| Explorer | https://blockscout-testnet.polkadot.io |
