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
  const baseUrl = usePro ? COINGECKO_PRO_URL : COINGECKO_PUBLIC_URL;
  const url = `${baseUrl}?ids=${encodeURIComponent(id)}&vs_currencies=${encodeURIComponent(vsCurrency)}`;
  const headers: Record<string, string> = {
    accept: "application/json",
    "user-agent": "polkadollar-oracle/1.0",
  };

  if (apiKey) {
    // Public/demo plans typically use x-cg-demo-api-key, pro uses x-cg-pro-api-key.
    headers["x-cg-demo-api-key"] = apiKey;
    headers["x-cg-pro-api-key"] = apiKey;
  }

  const response = await fetch(url, {
    headers,
  });

  if (!response.ok) {
    throw new Error(`CoinGecko request failed: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as Record<string, Record<string, number>>;
  const value = json[id]?.[vsCurrency];
  if (typeof value !== "number") {
    throw new Error(`CoinGecko response missing ${id}.${vsCurrency}`);
  }
  return value;
}

async function main() {
  const priceFeedAddress = envOrThrow("PRICE_FEED_ADDRESS");
  const coinId = (process.env.COINGECKO_ID ?? "polkadot").toLowerCase();
  const vsCurrency = (process.env.VS_CURRENCY ?? "usd").toLowerCase();
  const decimals = Number(process.env.PRICE_DECIMALS ?? "8");
  const intervalSeconds = Number(process.env.ORACLE_INTERVAL_SECONDS ?? "60");
  const once = (process.env.ORACLE_ONCE ?? "false").toLowerCase() === "true";

  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error(`PRICE_DECIMALS must be an integer between 0 and 18. Got: ${decimals}`);
  }
  if (!Number.isInteger(intervalSeconds) || intervalSeconds <= 0) {
    throw new Error(`ORACLE_INTERVAL_SECONDS must be a positive integer. Got: ${intervalSeconds}`);
  }

  const [operator] = await ethers.getSigners();
  const priceFeed = await ethers.getContractAt(
    [
      "function updatePrice(uint256 _price) external",
      "function price() external view returns (uint256)",
    ],
    priceFeedAddress,
    operator
  );

  console.log(`Oracle operator : ${operator.address}`);
  console.log(`Network         : ${network.name}`);
  console.log(`PriceFeed       : ${priceFeedAddress}`);
  console.log(`CoinGecko pair  : ${coinId}/${vsCurrency}`);
  console.log(`CoinGecko host  : ${(process.env.COINGECKO_USE_PRO ?? "false").toLowerCase() === "true" ? "pro-api.coingecko.com" : "api.coingecko.com"}`);
  console.log(`API key         : ${process.env.COINGECKO_API_KEY ? "provided" : "not provided"}`);
  console.log(`Decimals        : ${decimals}`);
  console.log(`Mode            : ${once ? "single update" : `loop every ${intervalSeconds}s`}`);

  const publish = async () => {
    const rawPrice = await fetchPrice(coinId, vsCurrency);
    const scaled = toScaledPrice(rawPrice, decimals);

    const tx = await priceFeed.updatePrice(scaled);
    const receipt = await tx.wait();

    console.log(
      `[${new Date().toISOString()}] price=${rawPrice} scaled=${scaled.toString()} tx=${receipt?.hash ?? tx.hash}`
    );
  };

  await publish();

  if (once) {
    return;
  }

  setInterval(async () => {
    try {
      await publish();
    } catch (err) {
      console.error(`[${new Date().toISOString()}] oracle tick failed`, err);
    }
  }, intervalSeconds * 1000);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
