/**
 * Demo 03 — Solidity EVM calls Rust PVM for heavy computation
 *
 * What this script does:
 *   1. Loads the compiled Rust Fibonacci contract binary
 *   2. Deploys it to Polkadot Hub as a PVM contract
 *   3. Deploys FibCaller.sol (EVM) with the PVM address as constructor arg
 *   4. Calls computeFib(10)  → expects 55
 *   5. Calls computeFib(50)  → expects 12586269025
 *
 * The key moment: step 4 and 5 are EVM→PVM cross-VM calls.
 * FibCaller runs in the EVM executor and calls into the Rust Fibonacci
 * contract running in the PVM executor. pallet-revive routes transparently.
 *
 * Prerequisites:
 *   cd rust-contract
 *   cargo +nightly build --release --target riscv32emac-unknown-none-elf
 *
 * Run: npx hardhat run scripts/demo.ts --network hub
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const BLOB_CANDIDATES = [
  path.join(__dirname, "../rust-contract/fibonacci.polkavm"),
  path.join(__dirname, "../rust-contract/target/riscv64emac-unknown-none-polkavm/release/fibonacci"),
];

function loadBlob(): Buffer {
  for (const p of BLOB_CANDIDATES) {
    if (fs.existsSync(p)) {
      console.log(`      Loading blob: ${path.relative(process.cwd(), p)}`);
      return fs.readFileSync(p);
    }
  }
  throw new Error(
    `Rust contract binary not found. Build it first:\n` +
    `  cd rust-contract\n` +
    `  cargo +nightly build --release --target riscv32emac-unknown-none-elf`
  );
}

function sep(label: string) {
  console.log(`\n${"─".repeat(56)}\n  ${label}\n${"─".repeat(56)}`);
}

async function check(label: string, actual: bigint, expected: bigint) {
  const ok = actual === expected;
  console.log(`      ${label} = ${actual}  ${ok ? "✓" : `✗ (expected ${expected})`}`);
  if (!ok) process.exit(1);
}

async function main() {
  sep("Demo 03 — EVM Calls PVM for Heavy Computation");

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`\n  Deployer : ${deployer.address}`);
  console.log(`  Balance  : ${ethers.formatEther(balance)} PAS`);

  if (balance === 0n) {
    console.error("\n  ⚠  No balance. Get PAS at: https://faucet.polkadot.io");
    process.exit(1);
  }

  // ── 1. Deploy Rust Fibonacci contract → PVM ───────────────────────────────
  console.log("\n  [1] Loading and deploying Fibonacci (Rust → RISC-V → PVM)...");
  const blob = loadBlob();
  console.log(`      Binary size: ${blob.length} bytes`);

  const deployFibTx = await deployer.sendTransaction({
    data: "0x" + blob.toString("hex"),
  });
  const deployFibReceipt = await deployFibTx.wait();

  if (!deployFibReceipt?.contractAddress) {
    throw new Error("Fibonacci deployment failed");
  }
  const fibAddress = deployFibReceipt.contractAddress;
  console.log(`      Fibonacci (PVM Rust) @ ${fibAddress}`);

  // ── 2. Deploy FibCaller.sol → EVM ─────────────────────────────────────────
  console.log("\n  [2] Deploying FibCaller.sol (Solidity → EVM)...");
  const FibCaller = await ethers.getContractFactory("FibCaller");
  const fibCaller = await FibCaller.deploy(fibAddress);
  await fibCaller.waitForDeployment();
  const fibCallerAddress = await fibCaller.getAddress();
  console.log(`      FibCaller  (EVM Solidity) @ ${fibCallerAddress}`);

  // ── Architecture ──────────────────────────────────────────────────────────
  console.log(`
  Architecture:
    FibCaller.sol (${fibCallerAddress})
      [EVM executor — solc]
        │
        │  IFibonacci(${fibAddress}).fib(n)
        │  ← pallet-revive routes to PVM →
        ▼
    fibonacci (${fibAddress})
      [PVM executor — Rust / RISC-V]
  `);

  // ── 3. computeFib(10) → 55 ────────────────────────────────────────────────
  console.log("  [3] Calling computeFib(10) via EVM → PVM cross-VM call...");
  const tx1 = await fibCaller.computeFib(10);
  const receipt1 = await tx1.wait();

  // Parse the FibResult event
  const iface = FibCaller.interface;
  const event1 = receipt1?.logs
    .map((log) => { try { return iface.parseLog(log); } catch { return null; } })
    .find((e) => e?.name === "FibResult");

  if (event1) {
    await check("fib(10)", event1.args.result, 55n);
  } else {
    console.log("      (event not parsed — checking via call)");
    const r = await fibCaller.computeFib.staticCall(10);
    await check("fib(10)", r, 55n);
  }

  // ── 4. computeFib(50) → 12586269025 ──────────────────────────────────────
  console.log("\n  [4] Calling computeFib(50)...");
  const tx2 = await fibCaller.computeFib(50);
  const receipt2 = await tx2.wait();

  const event2 = receipt2?.logs
    .map((log) => { try { return iface.parseLog(log); } catch { return null; } })
    .find((e) => e?.name === "FibResult");

  if (event2) {
    await check("fib(50)", event2.args.result, 12586269025n);
  } else {
    const r = await fibCaller.computeFib.staticCall(50);
    await check("fib(50)", r, 12586269025n);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`
  ✓  EVM FibCaller delegated computation to PVM Fibonacci.
     Two VMs. One transaction per call. No bridge.
     fib(50) = 12,586,269,025 — computed in Rust on RISC-V.
  `);

  sep("Done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
