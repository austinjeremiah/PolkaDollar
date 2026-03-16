import { ethers, network } from "hardhat";

const COINGECKO_PUBLIC_URL = "https://api.coingecko.com/api/v3/simple/price";
const COINGECKO_PRO_URL = "https://pro-api.coingecko.com/api/v3/simple/price";

function envOrThrow(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function toScaledPrice(raw: number, decimals: number): bigint {
  if (!Number.isFinite(raw) || raw <= 0) {
    throw new Error(`Invalid CoinGecko price value: ${raw}`);
  }
  return BigInt(Math.round(raw * 10 ** decimals));
}

async function fetchPrice(id: string, vsCurrency: string): Promise<number> {
  const apiKey = process.env.COINGECKO_API_KEY;
  const usePro = (process.env.COINGECKO_USE_PRO ?? "false").toLowerCase() === "true";
  const baseOrder = usePro ? [COINGECKO_PRO_URL, COINGECKO_PUBLIC_URL] : [COINGECKO_PUBLIC_URL, COINGECKO_PRO_URL];

  const baseHeaders: Record<string, string> = {
    accept: "application/json",
    "user-agent": "polkadollar-oracle/1.0",
  };

  if (apiKey) {
    baseHeaders["x-cg-demo-api-key"] = apiKey;
    baseHeaders["x-cg-pro-api-key"] = apiKey;
  }

  let lastError: string | null = null;
  for (const baseUrl of baseOrder) {
    const url = `${baseUrl}?ids=${encodeURIComponent(id)}&vs_currencies=${encodeURIComponent(vsCurrency)}`;
    const response = await fetch(url, { headers: baseHeaders });
    if (!response.ok) {
      lastError = `${response.status} ${response.statusText} @ ${baseUrl}`;
      continue;
    }

    const json = (await response.json()) as Record<string, Record<string, number>>;
    const value = json[id]?.[vsCurrency];
    if (typeof value !== "number") {
      throw new Error(`CoinGecko response missing ${id}.${vsCurrency}`);
    }
    return value;
  }

  throw new Error(`CoinGecko request failed: ${lastError ?? "unknown error"}`);
}

async function main() {
  const priceFeedAddress = envOrThrow("PRICE_FEED_ADDRESS");
  const riskEngineAddress = envOrThrow("RISK_ENGINE_ADDRESS");

  const coinId = (process.env.COINGECKO_ID ?? "polkadot").toLowerCase();
  const vsCurrency = (process.env.VS_CURRENCY ?? "usd").toLowerCase();
  const decimals = Number(process.env.PRICE_DECIMALS ?? "18");
  const intervalSeconds = Number(process.env.ORACLE_INTERVAL_SECONDS ?? "300");
  const once = (process.env.ORACLE_ONCE ?? "false").toLowerCase() === "true";

  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error(`PRICE_DECIMALS must be an integer between 0 and 18. Got: ${decimals}`);
  }

  const [operator] = await ethers.getSigners();
  const priceFeed = await ethers.getContractAt(
    ["function updatePrice(uint256 newPrice) external"],
    priceFeedAddress,
    operator
  );
  const riskEngine = await ethers.getContractAt(
    ["function pushPrice(uint256 price) external", "function assessRisk() external returns (uint8,uint256)"],
    riskEngineAddress,
    operator
  );

  console.log(`Oracle operator : ${operator.address}`);
  console.log(`Network         : ${network.name}`);
  console.log(`PriceFeed       : ${priceFeedAddress}`);
  console.log(`RiskEngine      : ${riskEngineAddress}`);
  console.log(`CoinGecko pair  : ${coinId}/${vsCurrency}`);

  const publish = async () => {
    const raw = await fetchPrice(coinId, vsCurrency);
    const scaled = toScaledPrice(raw, decimals);

    const txFeed = await priceFeed.updatePrice(scaled);
    const rFeed = await txFeed.wait();

    const txRisk = await riskEngine.pushPrice(scaled);
    const rRisk = await txRisk.wait();

    const txAssess = await riskEngine.assessRisk();
    const rAssess = await txAssess.wait();

    console.log(
      `[${new Date().toISOString()}] price=${raw} scaled=${scaled.toString()} feedTx=${rFeed?.hash ?? txFeed.hash} riskTx=${rRisk?.hash ?? txRisk.hash} assessTx=${rAssess?.hash ?? txAssess.hash}`
    );
  };

  await publish();

  if (!once) {
    setInterval(async () => {
      try {
        await publish();
      } catch (error) {
        console.error(`[${new Date().toISOString()}] tick failed`, error);
      }
    }, intervalSeconds * 1000);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
