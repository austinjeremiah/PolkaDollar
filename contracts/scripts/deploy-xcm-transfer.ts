import { ethers } from "hardhat";

const DEFAULT_PRECOMPILE = "0x000000000000000000000000000000000000A000";

async function main() {
  const precompile = process.env.XCM_PRECOMPILE_ADDRESS ?? DEFAULT_PRECOMPILE;
  const [deployer] = await ethers.getSigners();
  const nonceOverride = process.env.DEPLOY_NONCE ? Number(process.env.DEPLOY_NONCE) : undefined;
  const gasPriceGwei = process.env.DEPLOY_GAS_PRICE_GWEI;
  const maxFeeGwei = process.env.DEPLOY_MAX_FEE_GWEI;
  const maxPriorityFeeGwei = process.env.DEPLOY_MAX_PRIORITY_FEE_GWEI;

  const overrides: {
    nonce?: number;
    gasPrice?: bigint;
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
  } = {};

  if (nonceOverride !== undefined) {
    overrides.nonce = nonceOverride;
  }
  if (gasPriceGwei) {
    overrides.gasPrice = ethers.parseUnits(gasPriceGwei, "gwei");
  }
  if (maxFeeGwei) {
    overrides.maxFeePerGas = ethers.parseUnits(maxFeeGwei, "gwei");
  }
  if (maxPriorityFeeGwei) {
    overrides.maxPriorityFeePerGas = ethers.parseUnits(maxPriorityFeeGwei, "gwei");
  }

  console.log(`Deployer       : ${deployer.address}`);
  console.log(`XCM precompile : ${precompile}`);
  if (overrides.nonce !== undefined) {
    console.log(`Nonce override : ${overrides.nonce}`);
  }
  if (overrides.gasPrice !== undefined) {
    console.log(`Gas price      : ${ethers.formatUnits(overrides.gasPrice, "gwei")} gwei`);
  }
  if (overrides.maxFeePerGas !== undefined) {
    console.log(`Max fee        : ${ethers.formatUnits(overrides.maxFeePerGas, "gwei")} gwei`);
  }
  if (overrides.maxPriorityFeePerGas !== undefined) {
    console.log(`Priority fee   : ${ethers.formatUnits(overrides.maxPriorityFeePerGas, "gwei")} gwei`);
  }

  const Factory = await ethers.getContractFactory("XCMTransfer");
  const contract = await Factory.deploy(precompile, overrides);
  await contract.waitForDeployment();

  console.log(`XCMTransfer    : ${await contract.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
