"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePriceDirection, useProtocol } from "@/components/protocol/protocol-provider";
import { RiskGauge } from "@/components/protocol/risk-gauge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function regimeBg(regime: string) {
  if (regime === "LOW") return "bg-emerald-500/15 border-emerald-500/30 text-emerald-300";
  if (regime === "MEDIUM") return "bg-yellow-500/15 border-yellow-500/30 text-yellow-300";
  if (regime === "HIGH") return "bg-orange-500/15 border-orange-500/30 text-orange-300";
  return "bg-red-500/15 border-red-500/30 text-red-300";
}

export default function DashboardPage() {
  const { position, riskState, stats, lastUpdatedAt, priceHistory, ratioHistory } = useProtocol();
  const trend = usePriceDirection();
  const trendUp = trend >= 0;

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Dashboard</h1>
        <p className="text-sm text-zinc-400">Protocol overview with live risk context and market history.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-300">Cross-VM</span>
        <span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">Native Assets</span>
        <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">Precompiles</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-white/10 bg-[#141925]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-200">DOT Price</CardTitle>
            <CardDescription>Last updated {lastUpdatedAt || "-"}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums text-zinc-50">${Number(position.dotPrice || "0").toFixed(2)}</p>
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-zinc-400">
              {trendUp ? <ArrowUpRight className="h-3 w-3 text-emerald-400" /> : <ArrowDownRight className="h-3 w-3 text-red-400" />}
              {Math.abs(trend).toFixed(2)}% 24h direction
            </p>
          </CardContent>
        </Card>

        <Card className={`border ${regimeBg(riskState.regime)} bg-[#141925]`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Risk Regime</CardTitle>
            <CardDescription className="text-current/70">VOn-chain EWMA variance</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{riskState.regime}</p>
            <p className="mt-1 text-xs">Volatility: {riskState.volatilityPct.toFixed(2)}%</p>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#141925]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-200">Collateral Ratio</CardTitle>
            <CardDescription>Dynamic from Rust risk engine</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums text-zinc-50">{(riskState.ratioBps / 100).toFixed(0)}%</p>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#141925]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-200">Protocol Stats</CardTitle>
            <CardDescription>Live from vault and token contracts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="text-zinc-200">TVL: <span className="font-mono text-zinc-50">${Number(stats.tvlUsd).toLocaleString()}</span></p>
            <p className="text-zinc-200">pUSD Supply: <span className="font-mono text-zinc-50">{Number(stats.pusdSupply).toLocaleString()}</span></p>
            <p className="text-zinc-200">Active Positions: <span className="font-mono text-zinc-50">{stats.activePositions}</span></p>
          </CardContent>
        </Card>
      </div>

      <RiskGauge regime={riskState.regime} volatilityPct={riskState.volatilityPct} ratioPct={riskState.ratioBps / 100} />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-white/10 bg-[#141925]">
          <CardHeader>
            <CardTitle className="text-sm text-zinc-200">DOT Price History (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={priceHistory}>
                  <XAxis dataKey="day" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} domain={["dataMin - 0.2", "dataMax + 0.2"]} />
                  <Tooltip contentStyle={{ background: "#0f1115", border: "1px solid #2f3747" }} />
                  <Line type="monotone" dataKey="price" stroke="#f472b6" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#141925]">
          <CardHeader>
            <CardTitle className="text-sm text-zinc-200">Collateral Ratio History (30d)</CardTitle>
            <CardDescription>Step line from EWMA-derived regime transitions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ratioHistory}>
                  <XAxis dataKey="day" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} domain={[120, 230]} />
                  <Tooltip contentStyle={{ background: "#0f1115", border: "1px solid #2f3747" }} />
                  <Line type="stepAfter" dataKey="ratioPct" stroke="#a855f7" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
