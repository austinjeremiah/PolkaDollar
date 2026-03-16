import { ethers } from "hardhat";

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Missing env var: ${name}`);
  }
  return v;
}

async function main() {
  const riskEngine = requiredEnv("RISK_ENGINE_ADDRESS");
  const initialPrice = process.env.INITIAL_PRICE_18 ?? "7000000000000000000";
  const owner = process.env.OWNER_ADDRESS;

  const [deployer] = await ethers.getSigners();
  const admin = owner && owner.trim() !== "" ? owner : deployer.address;

  console.log(`Deployer          : ${deployer.address}`);
  console.log(`Backend owner     : ${admin}`);
  console.log(`Risk engine (PVM) : ${riskEngine}`);
  console.log(`Initial price(1e18): ${initialPrice}`);

  const PriceFeed = await ethers.getContractFactory("PriceFeed");
  const priceFeed = await PriceFeed.deploy(initialPrice, admin);
  await priceFeed.waitForDeployment();
  const priceFeedAddress = await priceFeed.getAddress();

  const PolkaDollar = await ethers.getContractFactory("PolkaDollar");
  const pusd = await PolkaDollar.deploy(admin);
  await pusd.waitForDeployment();
  const pusdAddress = await pusd.getAddress();

  const CollateralVault = await ethers.getContractFactory("CollateralVault");
  const vault = await CollateralVault.deploy(riskEngine, pusdAddress, priceFeedAddress, admin);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();

  const pusdWrite = await ethers.getContractAt("PolkaDollar", pusdAddress, deployer);
  const setVaultTx = await pusdWrite.setVault(vaultAddress);
  await setVaultTx.wait();

  console.log("\nDeployed backend:");
  console.log(`PriceFeed       : ${priceFeedAddress}`);
  console.log(`PolkaDollar     : ${pusdAddress}`);
  console.log(`CollateralVault : ${vaultAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
