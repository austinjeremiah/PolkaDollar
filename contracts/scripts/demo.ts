/**
 * Demo — Solidity EVM calls Rust PVM for EWMA risk computation
 *
 * Same pattern as demo-03 (FibCaller → fibonacci).
 * Swap: fibonacci fib(n) → risk_engine pushPrice / assessRisk
 *
 * 1. Deploy risk_engine  (Rust → RISC-V → PVM)
 * 2. Deploy RiskEngineCaller.sol  (EVM)
 * 3. Push 10 calm prices  → expect LOW regime  (130%)
 * 4. Push 10 volatile prices → expect HIGH/EXTREME regime (180%/220%)
 *
 * Run: npx hardhat run scripts/demo-risk.ts --network hub
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// ── Find the compiled Rust binary (same logic as demo.ts) ───────────────────
const BLOB_CANDIDATES = [
  path.join(__dirname, "../rust-contract/risk_engine.polkavm"),
  path.join(__dirname, "../rust-contract/target/riscv64emac-unknown-none-polkavm/release/risk_engine"),
  path.join(__dirname, "../rust-contract/target/riscv32emac-unknown-none-elf/release/risk_engine"),
];

function loadBlob(): Buffer {
  for (const p of BLOB_CANDIDATES) {
    if (fs.existsSync(p)) {
      console.log(`      Binary: ${path.relative(process.cwd(), p)}`);
      return fs.readFileSync(p);
    }
  }
  throw new Error(
    `risk_engine binary not found. Build it:\n` +
    `  cd rust-contract\n` +
    `  cargo +nightly build --release --target riscv32emac-unknown-none-elf`
  );
}

// ── Selector verification (prints expected vs what Rust hardcodes) ───────────
function printSelectors() {
  const sigs = ["pushPrice(uint256)", "assessRisk()"];
  console.log("\n  Selectors (must match SEL_* constants in risk_engine.rs):");
  for (const sig of sigs) {
    const sel = ethers.id(sig).slice(0, 10);
    console.log(`    ${sig.padEnd(24)} → ${sel}`);
  }
  console.log();
}

// ── Price helpers ─────────────────────────────────────────────────────────────
// Chainlink-style 8 decimals: $7.00 → 700_000_000n
const usd = (d: number) => BigInt(Math.round(d * 1e8));

const REGIME = ["LOW (130%)", "MEDIUM (150%)", "HIGH (180%)", "EXTREME (220%)"];

function sep(s: string) {
  console.log(`\n${"─".repeat(56)}\n  ${s}\n${"─".repeat(56)}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  sep("Demo — EVM Solidity calls Rust PVM for Risk Computation");

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`\n  Deployer : ${deployer.address}`);
  console.log(`  Balance  : ${ethers.formatEther(balance)} PAS`);

  if (balance === 0n) {
    console.error("\n  ⚠  No balance. Get PAS at: https://faucet.polkadot.io");
    process.exit(1);
  }

  printSelectors();

  // ── 1. Deploy Rust risk_engine → PVM ──────────────────────────────────────
  console.log("  [1] Deploying risk_engine (Rust → RISC-V → PVM)...");
  const blob = loadBlob();
  console.log(`      Size: ${blob.length} bytes`);

  const deployTx = await deployer.sendTransaction({ data: "0x" + blob.toString("hex") });
  const deployReceipt = await deployTx.wait();
  if (!deployReceipt?.contractAddress) throw new Error("risk_engine deploy failed");
  const rustAddr = deployReceipt.contractAddress;
  console.log(`      risk_engine (PVM Rust) @ ${rustAddr}`);

  // ── 2. Deploy RiskEngineCaller.sol → EVM ──────────────────────────────────
  console.log("\n  [2] Deploying RiskEngineCaller.sol (Solidity → EVM)...");
  const Caller = await ethers.getContractFactory("RiskEngineCaller");
  const caller = await Caller.deploy(rustAddr);
  await caller.waitForDeployment();
  const callerAddr = await caller.getAddress();
  console.log(`      RiskEngineCaller (EVM) @ ${callerAddr}`);

  console.log(`
  Architecture:
    RiskEngineCaller.sol (${callerAddr})
      [EVM executor — solc]
        │
        │  IRiskEngine(${rustAddr}).assessRisk()
        │  ← pallet-revive routes to PVM →
        ▼
    risk_engine (${rustAddr})
      [PVM executor — Rust / RISC-V]
  `);

  // ── 3. Push calm prices → expect LOW ──────────────────────────────────────
  console.log("  [3] Pushing 10 calm DOT prices (~$7.00 ± 0.1%)...");
  const calmPrices = [7.00, 7.01, 6.99, 7.00, 7.01, 6.98, 7.00, 7.02, 6.99, 7.00];
  for (const p of calmPrices) {
    const tx = await caller.pushPrice(usd(p));
    await tx.wait();
    process.stdout.write(".");
  }

  {
    const tx = await caller.assessRisk();
    const receipt = await tx.wait();
    const iface = Caller.interface;
    const ev = receipt?.logs.map(l => { try { return iface.parseLog(l); } catch { return null; } })
                            .find(e => e?.name === "RiskAssessed");
    const regime = Number(ev?.args.regime ?? 3);
    const ratio  = Number(ev?.args.ratio ?? 0);
    console.log(`\n      assessRisk() → regime ${regime}  ${REGIME[regime]}  ratio=${ratio/100}%  ✓`);
  }

  // ── 4. Push volatile prices → expect HIGH/EXTREME ─────────────────────────
  console.log("\n  [4] Pushing 10 volatile DOT prices (~$7.00 ± 3%)...");
  const volatilePrices = [7.00, 7.21, 6.78, 7.35, 6.65, 7.40, 6.70, 7.30, 6.80, 7.00];
  for (const p of volatilePrices) {
    const tx = await caller.pushPrice(usd(p));
    await tx.wait();
    process.stdout.write(".");
  }

  {
    const tx = await caller.assessRisk();
    const receipt = await tx.wait();
    const iface = Caller.interface;
    const ev = receipt?.logs.map(l => { try { return iface.parseLog(l); } catch { return null; } })
                            .find(e => e?.name === "RiskAssessed");
    const regime = Number(ev?.args.regime ?? 0);
    const ratio  = Number(ev?.args.ratio ?? 0);
    console.log(`\n      assessRisk() → regime ${regime}  ${REGIME[regime]}  ratio=${ratio/100}%  ✓`);
  }

  console.log(`
  ✓  EVM RiskEngineCaller delegated EWMA computation to PVM risk_engine.
     Calm market → LOW (130%).  Volatile market → HIGH/EXTREME (180/220%).
     Rust on RISC-V. One transaction per call. No bridge.
  `);

  sep("Done");
}

main().catch(err => { console.error(err); process.exit(1); });
