import { ethers, network } from "hardhat";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
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

async function sendWithRetry(
  txBuilder: () => Promise<any>,
  label: string
): Promise<any> {
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
    // Old engine may not expose getVariance; keep regime/ratio logs anyway.
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

  const stablePrice = BigInt(process.env.RESET_PRICE_18 || "7000000000000000000");
  const rounds = Number(process.env.RESET_ROUNDS || "20");
  const gapMs = Number(process.env.RESET_GAP_MS || "1000");

  if (!Number.isInteger(rounds) || rounds < 1) {
    throw new Error(`RESET_ROUNDS must be a positive integer. Got: ${process.env.RESET_ROUNDS}`);
  }
  if (!Number.isInteger(gapMs) || gapMs < 0) {
    throw new Error(`RESET_GAP_MS must be a non-negative integer. Got: ${process.env.RESET_GAP_MS}`);
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

  console.log(`Operator         : ${operator.address}`);
  console.log(`Network          : ${network.name}`);
  console.log(`PriceFeed        : ${priceFeedAddress}`);
  console.log(`RiskEngine       : ${riskEngineAddress}`);
  console.log(`Stable price     : ${stablePrice.toString()}`);
  console.log(`Rounds           : ${rounds}`);
  console.log(`Gap (ms)         : ${gapMs}`);

  const before = await readRisk(riskEngine);
  console.log(
    `Before reset     : regime=${before.regime} (${regimeLabel(before.regime)}) ratio=${before.ratioBps} variance=${before.variance?.toString() ?? "n/a"}`
  );

  for (let i = 1; i <= rounds; i++) {
    const feedReceipt = await sendWithRetry(
      () => priceFeed.updatePrice(stablePrice),
      `updatePrice round ${i}`
    );

    const riskReceipt = await sendWithRetry(
      () => riskEngine.pushPrice(stablePrice),
      `pushPrice round ${i}`
    );

    const current = await readRisk(riskEngine);
    console.log(
      `Round ${i}/${rounds}    : regime=${current.regime} (${regimeLabel(current.regime)}) ratio=${current.ratioBps} variance=${current.variance?.toString() ?? "n/a"} feedTx=${feedReceipt?.hash ?? "n/a"} riskTx=${riskReceipt?.hash ?? "n/a"}`
    );

    if (i < rounds && gapMs > 0) {
      await sleep(gapMs);
    }
  }

  const after = await readRisk(riskEngine);
  console.log(
    `After reset      : regime=${after.regime} (${regimeLabel(after.regime)}) ratio=${after.ratioBps} variance=${after.variance?.toString() ?? "n/a"}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
