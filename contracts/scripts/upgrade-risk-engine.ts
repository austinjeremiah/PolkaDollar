/**
 * upgrade-risk-engine.ts
 *
 * 1. Deploys updated risk_engine.polkavm to Polkadot Hub
 *    (adds getVariance() selector 0x3e09e777)
 * 2. Calls CollateralVault.setRiskEngine(newAddr) so the vault uses the new one
 * 3. Prints env-var lines to update in frontend/.env
 *
 * Run:
 *   VAULT_ADDRESS=0x... npm run upgrade:risk-engine
 *
 * Make sure you have run:
 *   npm run build:rust:risk
 * first to generate the updated rust-contract/risk_engine.polkavm binary.
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") throw new Error(`Missing env var: ${name}`);
  return v;
}

async function main() {
  const vaultAddress = requiredEnv("VAULT_ADDRESS");

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer   : ${deployer.address}`);
  console.log(`Vault      : ${vaultAddress}`);

  // 1. Load the built .polkavm blob
  const blobPath = path.join(__dirname, "../rust-contract/risk_engine.polkavm");
  if (!fs.existsSync(blobPath)) {
    throw new Error(`risk_engine.polkavm not found at ${blobPath}.\nRun: npm run build:rust:risk`);
  }
  const blob = fs.readFileSync(blobPath);
  console.log(`\nBlob       : ${blob.length} bytes  (${blobPath})`);

  // 2. Deploy by sending raw blob as transaction data (pallet-revive pattern)
  console.log("Deploying risk_engine (Rust → RISC-V → PolkaVM)...");
  const deployTx = await deployer.sendTransaction({ data: "0x" + blob.toString("hex") });
  const receipt = await deployTx.wait();
  if (!receipt?.contractAddress) throw new Error("Deploy failed — no contractAddress in receipt");

  const newRiskEngine = receipt.contractAddress;
  console.log(`\nNew risk_engine @ ${newRiskEngine}`);
  console.log(`Deploy tx      : ${receipt.hash}`);

  // 3. Wire the new address into the vault
  console.log("\nCalling CollateralVault.setRiskEngine...");
  const vault = await ethers.getContractAt(
    ["function setRiskEngine(address) external"],
    vaultAddress,
    deployer
  );
  const wireTx = await vault.setRiskEngine(newRiskEngine);
  await wireTx.wait();
  console.log(`setRiskEngine tx : ${wireTx.hash}`);

  // 4. Print env lines
  console.log("\n─── Update frontend/.env ──────────────────────────────────");
  console.log(`NEXT_PUBLIC_RISK_ENGINE_ADDRESS=${newRiskEngine}`);
  console.log("──────────────────────────────────────────────────────────");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
