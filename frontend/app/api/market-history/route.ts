import { NextResponse } from "next/server";

type CoinGeckoSeries = {
  prices: [number, number][];
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = searchParams.get("days") || "60";

  try {
    const url = `https://api.coingecko.com/api/v3/coins/polkadot/market_chart?vs_currency=usd&days=${days}&interval=daily`;
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "polkadollar-frontend/1.0",
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      return NextResponse.json({ points: [] }, { status: 200 });
    }

    const data = (await response.json()) as CoinGeckoSeries;
    const points = (data.prices || []).map((p) => ({
      day: new Date(p[0]).toISOString().slice(5, 10),
      price: Number(p[1].toFixed(4)),
    }));

    return NextResponse.json({ points });
  } catch {
    return NextResponse.json({ points: [] }, { status: 200 });
  }
}
