import { ethers } from "hardhat";

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Missing env var: ${name}`);
  }
  return v;
}

async function main() {
  const vaultAddress = requiredEnv("VAULT_ADDRESS");
  const owner = process.env.OWNER_ADDRESS;

  const [deployer] = await ethers.getSigners();
  const admin = owner && owner.trim() !== "" ? owner : deployer.address;

  const vault = await ethers.getContractAt(
    [
      "function pusd() external view returns (address)",
      "function setPusd(address _pusd) external",
    ],
    vaultAddress,
    deployer
  );

  let pusdAddress = process.env.PUSD_ADDRESS;
  if (!pusdAddress || pusdAddress.trim() === "") {
    const PolkaDollar = await ethers.getContractFactory("PolkaDollar");
    const pusd = await PolkaDollar.deploy(admin);
    await pusd.waitForDeployment();
    pusdAddress = await pusd.getAddress();
    console.log(`Deployed PolkaDollar: ${pusdAddress}`);
  }

  const current = await vault.pusd();
  console.log(`Vault              : ${vaultAddress}`);
  console.log(`Current vault pUSD : ${current}`);
  console.log(`Target pUSD        : ${pusdAddress}`);

  if (current.toLowerCase() !== ethers.ZeroAddress.toLowerCase()) {
    throw new Error("Vault already has pUSD set; skipping write for safety.");
  }

  const tx = await vault.setPusd(pusdAddress);
  await tx.wait();

  console.log(`Wired pUSD into vault tx: ${tx.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
