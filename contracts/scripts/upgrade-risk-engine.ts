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

function isAlreadyImportedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return msg.includes("transaction already imported") || msg.includes("already known");
}

function isNonceTooLowError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return msg.includes("nonce too low") || msg.includes("already used");
}

function isPriorityTooLowError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return msg.includes("priority is too low") || msg.includes("replacement transaction underpriced");
}

async function sendDeployWithRetry(deployer: any, dataHex: string) {
  const provider = deployer.provider;
  if (!provider) {
    throw new Error("No provider on signer");
  }

  let nonce = await provider.getTransactionCount(deployer.address, "pending");
  const fee = await provider.getFeeData();
  const fallbackBase = ethers.parseUnits("1000", "gwei");
  let baseFee = fee.maxFeePerGas ?? fee.gasPrice ?? fallbackBase;
  let tip = fee.maxPriorityFeePerGas ?? ethers.parseUnits("2", "gwei");

  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Replacement rules are generally tip-based; bump both tip and fee cap aggressively.
      const tipBumped = (tip * BigInt(150 + (attempt - 1) * 50)) / 100n;
      const maxFeeBumped = (baseFee * BigInt(170 + (attempt - 1) * 70)) / 100n + tipBumped;
      console.log(
        `Deploy attempt ${attempt}/${maxAttempts} nonce=${nonce} maxPriorityFeePerGas=${tipBumped} maxFeePerGas=${maxFeeBumped}`
      );

      const tx = await deployer.sendTransaction({
        data: dataHex,
        nonce,
        maxPriorityFeePerGas: tipBumped,
        maxFeePerGas: maxFeeBumped,
      });

      console.log(`Deploy tx hash  : ${tx.hash}`);
      const receipt = await tx.wait();
      return { tx, receipt };
    } catch (err) {
      if (isAlreadyImportedError(err)) {
        console.log("Node already has this tx. Retrying with replacement gas price...");
        continue;
      }

      if (isPriorityTooLowError(err)) {
        // For replacement semantics, bump both tip and fee cap before next attempt.
        tip = (tip * 2n) / 1n;
        baseFee = (baseFee * 3n) / 2n;
        console.log(
          `Priority too low from node, bumping baseFee=${baseFee} and tip=${tip} and retrying...`
        );
        continue;
      }

      if (isNonceTooLowError(err)) {
        nonce = await provider.getTransactionCount(deployer.address, "pending");
        console.log(`Nonce updated to ${nonce} after nonce error, retrying...`);
        continue;
      }

      throw err;
    }
  }

  throw new Error("Failed to deploy risk engine after retries. Please wait for pending tx to settle and retry.");
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
  const { tx: deployTx, receipt } = await sendDeployWithRetry(deployer, "0x" + blob.toString("hex"));
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
