import { ethers, network } from "hardhat";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optionalEnv(name: string): string | null {
  const value = process.env[name];
  if (!value || value.trim() === "") return null;
  return value;
}

function toBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function regimeLabel(regime: number): string {
  switch (regime) {
    case 0:
      return "LOW";
    case 1:
      return "MEDIUM";
    case 2:
      return "HIGH";
    case 3:
      return "EXTREME";
    default:
      return `UNKNOWN(${regime})`;
  }
}

function isRetryablePriorityError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    msg.includes("priority is too low") ||
    msg.includes("replacement transaction underpriced") ||
    msg.includes("transaction already imported") ||
    msg.includes("already known") ||
    msg.includes("invalid transaction")
  );
}

function isNonceError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return msg.includes("nonce too low") || msg.includes("already used");
}

async function sendWithRetry(txBuilder: () => Promise<any>, label: string): Promise<any> {
  const maxAttempts = 6;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const tx = await txBuilder();
      return await tx.wait();
    } catch (err) {
      if (isRetryablePriorityError(err)) {
        const waitMs = attempt * 1200;
        console.log(`${label}: node rejected tx (${attempt}/${maxAttempts}), retrying in ${waitMs}ms...`);
        await sleep(waitMs);
        continue;
      }

      if (isNonceError(err)) {
        const waitMs = attempt * 800;
        console.log(`${label}: nonce race detected (${attempt}/${maxAttempts}), retrying in ${waitMs}ms...`);
        await sleep(waitMs);
        continue;
      }

      throw err;
    }
  }

  throw new Error(`${label}: failed after retry attempts`);
}

async function readRisk(riskEngine: any): Promise<{ regime: number; ratioBps: bigint; variance: bigint | null }> {
  const [regimeRaw, ratioRaw] = await riskEngine.assessRisk.staticCall();

  let variance: bigint | null = null;
  try {
    variance = BigInt(await riskEngine.getVariance());
  } catch {
    variance = null;
  }

  return {
    regime: Number(regimeRaw),
    ratioBps: BigInt(ratioRaw),
    variance,
  };
}

async function main() {
  const priceFeedAddress = requiredEnv("PRICE_FEED_ADDRESS");
  const riskEngineAddress = requiredEnv("RISK_ENGINE_ADDRESS");
  const targetUser = optionalEnv("SIM_TARGET_USER");
  const vaultAddress = optionalEnv("VAULT_ADDRESS");

  const rounds = Number(process.env.SPIKE_ROUNDS || "20");
  const gapMs = Number(process.env.SPIKE_GAP_MS || "1000");
  const lowPrice = BigInt(process.env.SPIKE_LOW_PRICE_18 || "3000000000000000000");
  const highPrice = BigInt(process.env.SPIKE_HIGH_PRICE_18 || "11000000000000000000");
  const outputEvery = Math.max(1, Number(process.env.SPIKE_OUTPUT_EVERY || "1"));
  const zigZag = toBool(process.env.SPIKE_ZIGZAG, true);

  if (!Number.isInteger(rounds) || rounds < 1) {
    throw new Error(`SPIKE_ROUNDS must be a positive integer. Got: ${process.env.SPIKE_ROUNDS}`);
  }
  if (!Number.isInteger(gapMs) || gapMs < 0) {
    throw new Error(`SPIKE_GAP_MS must be a non-negative integer. Got: ${process.env.SPIKE_GAP_MS}`);
  }
  if (lowPrice <= 0n || highPrice <= 0n) {
    throw new Error("SPIKE_LOW_PRICE_18 and SPIKE_HIGH_PRICE_18 must be > 0");
  }
  if (lowPrice === highPrice) {
    throw new Error("SPIKE_LOW_PRICE_18 and SPIKE_HIGH_PRICE_18 must be different");
  }

  const [operator] = await ethers.getSigners();

  const priceFeed = await ethers.getContractAt(
    ["function updatePrice(uint256 newPrice) external"],
    priceFeedAddress,
    operator
  );

  const riskEngine = await ethers.getContractAt(
    [
      "function pushPrice(uint256 price) external",
      "function assessRisk() external returns (uint8,uint256)",
      "function getVariance() view returns (uint256)",
    ],
    riskEngineAddress,
    operator
  );

  const vault = targetUser && vaultAddress
    ? await ethers.getContractAt(
        [
          "function collateral(address user) external view returns (uint256)",
          "function debt(address user) external view returns (uint256)",
          "function healthFactor(address user) external view returns (uint256)",
        ],
        vaultAddress,
        operator
      )
    : null;

  console.log(`Operator         : ${operator.address}`);
  console.log(`Network          : ${network.name}`);
  console.log(`PriceFeed        : ${priceFeedAddress}`);
  console.log(`RiskEngine       : ${riskEngineAddress}`);
  console.log(`Target user      : ${targetUser ?? "(not set)"}`);
  console.log(`Vault            : ${vaultAddress ?? "(not set)"}`);
  console.log(`Rounds           : ${rounds}`);
  console.log(`Gap (ms)         : ${gapMs}`);
  console.log(`Low price        : ${lowPrice.toString()}`);
  console.log(`High price       : ${highPrice.toString()}`);
  console.log(`Pattern          : ${zigZag ? "zig-zag" : "random"}`);

  const before = await readRisk(riskEngine);
  console.log(
    `Before spike     : regime=${before.regime} (${regimeLabel(before.regime)}) ratio=${before.ratioBps} variance=${before.variance?.toString() ?? "n/a"}`
  );

  if (vault && targetUser) {
    const [collateral, debt, health] = await Promise.all([
      vault.collateral(targetUser),
      vault.debt(targetUser),
      vault.healthFactor(targetUser),
    ]);
    console.log(
      `Target before    : collateral=${ethers.formatEther(collateral)} debt=${ethers.formatEther(debt)} health=${Number(health) / 10000}`
    );
  }

  for (let i = 1; i <= rounds; i++) {
    const price = zigZag
      ? (i % 2 === 1 ? highPrice : lowPrice)
      : (Math.random() < 0.5 ? highPrice : lowPrice);

    const feedReceipt = await sendWithRetry(
      () => priceFeed.updatePrice(price),
      `updatePrice round ${i}`
    );

    const riskReceipt = await sendWithRetry(
      () => riskEngine.pushPrice(price),
      `pushPrice round ${i}`
    );

    if (i % outputEvery === 0 || i === rounds) {
      const current = await readRisk(riskEngine);
      console.log(
        `Round ${i}/${rounds}    : price=${price} regime=${current.regime} (${regimeLabel(current.regime)}) ratio=${current.ratioBps} variance=${current.variance?.toString() ?? "n/a"} feedTx=${feedReceipt?.hash ?? "n/a"} riskTx=${riskReceipt?.hash ?? "n/a"}`
      );

      if (vault && targetUser) {
        const [collateral, debt, health] = await Promise.all([
          vault.collateral(targetUser),
          vault.debt(targetUser),
          vault.healthFactor(targetUser),
        ]);
        console.log(
          `Target round ${i} : collateral=${ethers.formatEther(collateral)} debt=${ethers.formatEther(debt)} health=${Number(health) / 10000}`
        );
      }
    }

    if (i < rounds && gapMs > 0) {
      await sleep(gapMs);
    }
  }

  const after = await readRisk(riskEngine);
  console.log(
    `After spike      : regime=${after.regime} (${regimeLabel(after.regime)}) ratio=${after.ratioBps} variance=${after.variance?.toString() ?? "n/a"}`
  );

  if (vault && targetUser) {
    const [collateral, debt, health] = await Promise.all([
      vault.collateral(targetUser),
      vault.debt(targetUser),
      vault.healthFactor(targetUser),
    ]);
    console.log(
      `Target after     : collateral=${ethers.formatEther(collateral)} debt=${ethers.formatEther(debt)} health=${Number(health) / 10000}`
    );
    if (health < 12000n) {
      console.log("Liquidation flag : target health is below 1.2 and is likely liquidatable.");
    } else {
      console.log("Liquidation flag : target health is above 1.2.");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});