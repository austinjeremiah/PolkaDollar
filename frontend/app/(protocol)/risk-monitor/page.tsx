"use client";

import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RiskGauge } from "@/components/protocol/risk-gauge";
import { useProtocol } from "@/components/protocol/protocol-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const RISK_ENGINE = process.env.NEXT_PUBLIC_RISK_ENGINE_ADDRESS || "0x1a5b66d8b4170213696D7a0Ec465fFF165E6ba2B";
const VAULT = process.env.NEXT_PUBLIC_VAULT_ADDRESS || "0x54Dc42542E36F10b5Ff8B60A00cf1e48278006ae";
const EXPLORER = process.env.NEXT_PUBLIC_EXPLORER_URL || "https://blockscout-testnet.polkadot.io/";

export default function RiskMonitorPage() {
  const { riskState, ratioHistory, priceHistory, xcmPrecompile } = useProtocol();

  const overlayData = ratioHistory.map((r, index) => ({
    day: r.day,
    ratioPct: r.ratioPct,
    price: priceHistory[index]?.price ?? null,
  }));

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Risk Monitor</h1>
        <p className="text-sm text-zinc-400">Rust PolkaVM regime engine telemetry and collateral policy behavior.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="border-white/10 bg-[#141925]">
          <CardHeader>
            <CardTitle className="text-sm text-zinc-200">Volatility</CardTitle>
            <CardDescription>EWMA daily volatility</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums text-zinc-50">{riskState.volatilityPct.toFixed(2)}%</p>
            <p className="mt-1 text-xs text-zinc-500">Computed via Rust risk engine state transitions</p>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#141925] xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm text-zinc-200">Current Regime</CardTitle>
            <CardDescription>Threshold-classified risk bucket</CardDescription>
          </CardHeader>
          <CardContent>
            <RiskGauge regime={riskState.regime} volatilityPct={riskState.volatilityPct} ratioPct={riskState.ratioBps / 100} compact />
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#141925]">
          <CardHeader>
            <CardTitle className="text-sm text-zinc-200">Collateral Ratio</CardTitle>
            <CardDescription>{riskState.regime} regime maps to {(riskState.ratioBps / 100).toFixed(0)}%</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums text-zinc-50">{(riskState.ratioBps / 100).toFixed(0)}%</p>
            <p className="mt-2 text-xs text-zinc-500">Range: 130% to 220%</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-white/10 bg-[#141925]">
          <CardHeader>
            <CardTitle className="text-sm text-zinc-200">Volatility Over Time</CardTitle>
            <CardDescription>EWMA area chart with regime boundaries</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ratioHistory}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#263043" />
                  <XAxis dataKey="day" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#0f1115", border: "1px solid #2f3747" }} />
                  <Area type="monotone" dataKey="volatilityPct" stroke="#f59e0b" fill="#f59e0b33" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#141925]">
          <CardHeader>
            <CardTitle className="text-sm text-zinc-200">DOT Price + Ratio Overlay</CardTitle>
            <CardDescription>Dual-axis view of market and policy response</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={overlayData}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#263043" />
                  <XAxis dataKey="day" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="price" orientation="left" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="ratio" orientation="right" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} domain={[120, 230]} />
                  <Tooltip contentStyle={{ background: "#0f1115", border: "1px solid #2f3747" }} />
                  <Legend />
                  <Line yAxisId="price" type="monotone" dataKey="price" stroke="#ec4899" strokeWidth={2} dot={false} name="DOT Price" />
                  <Line yAxisId="ratio" type="stepAfter" dataKey="ratioPct" stroke="#a855f7" strokeWidth={2} dot={false} name="Collateral Ratio" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-purple-500/20 bg-[#141925]">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-300">Rust / PolkaVM</span>
            <CardTitle className="text-sm text-zinc-200">On-Chain Risk Engine</CardTitle>
          </div>
          <CardDescription>Cross-VM computation — Solidity invokes Rust in a single atomic transaction</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-x-8 gap-y-2 text-xs sm:grid-cols-2">
            <Detail label="Model" value="EWMA variance estimator" />
            <Detail label="Decay factor (λ)" value="0.94 per price update" />
            <Detail label="Regime T1 → LOW" value="σ &lt; 3.16% → 130% ratio" />
            <Detail label="Regime T2 → MEDIUM" value="σ &lt; 6.32% → 150% ratio" />
            <Detail label="Regime T3 → HIGH" value="σ &lt; 9.49% → 180% ratio" />
            <Detail label="Regime T4 → EXTREME" value="σ ≥ 9.49% → 220% ratio" />
            <Detail label="Liquidation threshold" value="Health factor &lt; 1.2" />
            <Detail label="Oracle max age" value="1 800 s (30 min)" />
          </div>

          <div className="space-y-2 rounded-md border border-white/10 bg-black/20 p-3 text-xs">
            <p className="text-zinc-400">Contract addresses — Polkadot Hub TestNet</p>
            <p className="font-mono break-all text-zinc-300">
              RiskEngine:{" "}
              <a href={`${EXPLORER}address/${RISK_ENGINE}`} target="_blank" rel="noreferrer" className="text-purple-300 hover:text-purple-200 underline underline-offset-2">
                {RISK_ENGINE}
              </a>
            </p>
            <p className="font-mono break-all text-zinc-300">
              CollateralVault:{" "}
              <a href={`${EXPLORER}address/${VAULT}`} target="_blank" rel="noreferrer" className="text-pink-300 hover:text-pink-200 underline underline-offset-2">
                {VAULT}
              </a>
            </p>
            <p className="font-mono break-all text-zinc-300">
              XCM Precompile: <span className="text-emerald-300">{xcmPrecompile}</span>
            </p>
          </div>

          <p className="text-xs text-zinc-500">
            Written in Rust, compiled to PolkaVM RISC-V bytecode, deployed on Polkadot Hub. Called synchronously by CollateralVault on every mint, withdraw, and liquidation — no oracle round-trip, no off-chain relayer. The Solidity contract holds value; the Rust contract holds intelligence.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-zinc-500">{label}</p>
      <p className="text-zinc-200">{value}</p>
    </div>
  );
}
