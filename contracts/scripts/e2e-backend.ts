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
  const pusdAddress = requiredEnv("PUSD_ADDRESS");
  const priceFeedAddress = requiredEnv("PRICE_FEED_ADDRESS");
  const riskEngineAddress = requiredEnv("RISK_ENGINE_ADDRESS");

  const [user] = await ethers.getSigners();

  const vault = await ethers.getContractAt(
    [
      "function deposit() external payable",
      "function mint(uint256 pusdAmount) external",
      "function burn(uint256 pusdAmount) external",
      "function withdraw(uint256 amount) external",
      "function collateral(address user) external view returns (uint256)",
      "function debt(address user) external view returns (uint256)",
    ],
    vaultAddress,
    user
  );

  const pusd = await ethers.getContractAt(
    [
      "function balanceOf(address) external view returns (uint256)",
      "function approve(address,uint256) external returns (bool)",
    ],
    pusdAddress,
    user
  );

  const priceFeed = await ethers.getContractAt(
    ["function updatePrice(uint256) external"],
    priceFeedAddress,
    user
  );

  const riskEngine = await ethers.getContractAt(
    ["function pushPrice(uint256) external", "function assessRisk() external returns (uint8,uint256)"],
    riskEngineAddress,
    user
  );

  const price = BigInt(process.env.TEST_PRICE_18 ?? "7000000000000000000");
  const vaultPriceDecimals = BigInt(process.env.VAULT_PRICE_DECIMALS ?? "1000000000000000000");
  const depositAmount = ethers.parseEther(process.env.TEST_DEPOSIT_DOT ?? "1.0");
  let mintAmount = ethers.parseEther(process.env.TEST_MINT_PUSD ?? "1.0");
  let burnAmount = ethers.parseEther(process.env.TEST_BURN_PUSD ?? "0.5");
  const withdrawAmount = ethers.parseEther(process.env.TEST_WITHDRAW_DOT ?? "0.1");
  const autoMint = (process.env.TEST_AUTO_MINT ?? "true").toLowerCase() === "true";

  console.log(`User              : ${user.address}`);
  console.log(`Vault             : ${vaultAddress}`);
  console.log(`pUSD              : ${pusdAddress}`);
  console.log(`PriceFeed         : ${priceFeedAddress}`);
  console.log(`RiskEngine        : ${riskEngineAddress}`);

  const [initialCollateral, initialDebt] = await Promise.all([
    vault.collateral(user.address),
    vault.debt(user.address),
  ]);
  console.log(`Initial collateral: ${ethers.formatEther(initialCollateral)}`);
  console.log(`Initial debt      : ${ethers.formatEther(initialDebt)}`);

  console.log("\n[1] Update feed + push risk price");
  await (await priceFeed.updatePrice(price)).wait();
  await (await riskEngine.pushPrice(price)).wait();
  const assessTx = await riskEngine.assessRisk();
  const assessReceipt = await assessTx.wait();

  let ratioBps = 15000n;
  for (const log of assessReceipt?.logs ?? []) {
    const topics = (log as { topics?: string[] }).topics;
    if (topics && topics.length > 0) {
      // Ratio parsing is optional in this generic runner; we keep a safe fallback.
      ratioBps = 15000n;
      break;
    }
  }

  console.log("[2] Deposit collateral");
  await (await vault.deposit({ value: depositAmount })).wait();

  const postDepositCollateral = await vault.collateral(user.address);
  const currentDebt = await vault.debt(user.address);
  const collateralUsd = (postDepositCollateral * price) / vaultPriceDecimals;
  const maxDebt = (collateralUsd * 10000n) / ratioBps;
  const headroom = maxDebt > currentDebt ? maxDebt - currentDebt : 0n;

  if (autoMint && mintAmount > headroom) {
    mintAmount = headroom > 0n ? (headroom * 90n) / 100n : 0n;
  }

  console.log(`Computed headroom : ${ethers.formatEther(headroom)} pUSD`);
  console.log(`Mint target       : ${ethers.formatEther(mintAmount)} pUSD`);
  if (mintAmount == 0n) {
    throw new Error("No mint headroom available for this wallet. Use a fresh address or deposit more collateral.");
  }

  console.log("[3] Mint pUSD");
  await (await vault.mint(mintAmount)).wait();

  console.log("[4] Burn part of debt");
  const [postMintDebt, postMintBalance] = await Promise.all([
    vault.debt(user.address),
    pusd.balanceOf(user.address),
  ]);
  if (burnAmount > postMintDebt) burnAmount = postMintDebt;
  if (burnAmount > postMintBalance) burnAmount = postMintBalance;

  console.log(`Burn target       : ${ethers.formatEther(burnAmount)} pUSD`);
  if (burnAmount === 0n) {
    throw new Error("No burnable pUSD available for this wallet.");
  }

  const approveTx = await pusd.approve(vaultAddress, burnAmount);
  await approveTx.wait();
  await (await vault.burn(burnAmount)).wait();

  console.log("[5] Withdraw collateral");
  await (await vault.withdraw(withdrawAmount)).wait();

  const [finalCollateral, finalDebt, finalBalance] = await Promise.all([
    vault.collateral(user.address),
    vault.debt(user.address),
    pusd.balanceOf(user.address),
  ]);

  console.log("\nFinal state:");
  console.log(`collateral : ${ethers.formatEther(finalCollateral)}`);
  console.log(`debt       : ${ethers.formatEther(finalDebt)}`);
  console.log(`pUSD bal   : ${ethers.formatEther(finalBalance)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
