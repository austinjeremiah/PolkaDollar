# PolkaDollar — Frontend

Next.js frontend for the PolkaDollar lending protocol on Polkadot Hub.

---

## Prerequisites

- Node.js 20+
- pnpm 9+
- MetaMask browser extension
- Paseo testnet PAS tokens ([faucet](https://faucet.polkadot.io/))

---

## Setup

**1. Install dependencies**

```bash
pnpm install
```

**2. Configure environment**

```bash
cp .env.example .env
```

`.env` is pre-populated with deployed testnet contract addresses. No changes needed to run against the live contracts.

**3. Run dev server**

```bash
pnpm run dev
```

Opens at `http://localhost:3000`.

---

## Connect Wallet

Add Polkadot Hub TestNet to MetaMask:

| Field | Value |
|---|---|
| RPC | `https://eth-rpc-testnet.polkadot.io/` |
| Chain ID | `420420417` |
| Symbol | `PAS` |
| Explorer | `https://blockscout-testnet.polkadot.io/` |

---

## Pages

| Route | Description |
|---|---|
| `/` | Landing page |
| `/dashboard` | Protocol overview — DOT price, TVL, pUSD supply, risk regime, stability score |
| `/vault` | Deposit DOT, mint pUSD, burn debt, withdraw collateral, liquidate positions |
| `/bridge` | Send pUSD cross-chain to other parachains via XCM |
| `/risk-monitor` | EWMA volatility over time, regime history, collateral ratio overlay |
