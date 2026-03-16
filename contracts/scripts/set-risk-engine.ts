import { ethers } from "hardhat";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

async function main() {
  const vaultAddress = requiredEnv("VAULT_ADDRESS");
  const riskEngineAddress = requiredEnv("RISK_ENGINE_ADDRESS");

  const [signer] = await ethers.getSigners();
  console.log(`Signer          : ${signer.address}`);
  console.log(`Vault           : ${vaultAddress}`);
  console.log(`New Risk Engine : ${riskEngineAddress}`);

  const vault = await ethers.getContractAt(
    [
      "function riskEngine() external view returns (address)",
      "function setRiskEngine(address _riskEngine) external"
    ],
    vaultAddress,
    signer
  );

  const current = await vault.riskEngine();
  console.log(`Current Risk    : ${current}`);

  if (current.toLowerCase() === riskEngineAddress.toLowerCase()) {
    console.log("Already wired. No transaction needed.");
    return;
  }

  const tx = await vault.setRiskEngine(riskEngineAddress);
  console.log(`setRiskEngine tx: ${tx.hash}`);
  await tx.wait();
  console.log("Risk engine updated successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
