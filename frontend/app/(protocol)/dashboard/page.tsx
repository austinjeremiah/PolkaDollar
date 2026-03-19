"use client";

import { ArrowDownRight, ArrowUpRight, Minus, Move } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePriceDirection, useProtocol } from "@/components/protocol/protocol-provider";
import { RiskGauge } from "@/components/protocol/risk-gauge";
import { StabilityGauge } from "@/components/protocol/stability-gauge";

function regimeColor(regime: string) {
  if (regime === "LOW") return "text-teal-400";
  if (regime === "MEDIUM") return "text-yellow-400";
  if (regime === "HIGH") return "text-orange-400";
  return "text-red-400";
}

function MbCard({ children, coords = "X:0 Y:0", className = "" }: { children: React.ReactNode; coords?: string; className?: string }) {
  return (
    <div className={`rounded-sm border border-white/[0.18] bg-[#0d0f13] ${className}`}>
      <div className="flex items-center justify-between border-b border-white/[0.08] px-3 py-2">
        <div className="flex items-center gap-2 text-zinc-600">
          <Minus className="h-3 w-3" />
          <Move className="h-3 w-3" />
        </div>
        <span className="font-mono text-[10px] tracking-widest text-zinc-600">{coords}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { position, riskState, stats, lastUpdatedAt, priceHistory, ratioHistory, stabilityResult } = useProtocol();
  const trend = usePriceDirection();
  const trendUp = trend >= 0;
  const hasResult = stabilityResult !== null;

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-pixel text-5xl sm:text-6xl lg:text-7xl tracking-tight text-white">POLKADOLLAR</h1>
        <p className="mt-1 text-sm text-zinc-500">Protocol overview with live risk context and market history.</p>
      </div>

      {/* Top stat cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MbCard coords="X:0 Y:0">
          <p className="text-xs font-mono uppercase tracking-widest text-zinc-200">DOT Price</p>
          <p className="mt-1 text-[11px] text-zinc-600">Last updated {lastUpdatedAt || "-"}</p>
          <p className="mt-3 font-pixel text-4xl text-white">
            ${Number(position.dotPrice || "0").toFixed(2)}
          </p>
          <p className="mt-2 inline-flex items-center gap-1 font-mono text-xs text-zinc-500">
            {trendUp
              ? <ArrowUpRight className="h-3 w-3 text-teal-400" />
              : <ArrowDownRight className="h-3 w-3 text-red-400" />}
            <span className={trendUp ? "text-teal-400" : "text-red-400"}>
              {Math.abs(trend).toFixed(2)}%
            </span>{" "}
            24h direction
          </p>
        </MbCard>

        <MbCard coords="X:1 Y:0">
          <p className="text-xs font-mono uppercase tracking-widest text-zinc-200">Risk Regime</p>
          <p className="mt-1 text-[11px] text-zinc-600">On-chain EWMA variance</p>
          <p className={`mt-3 font-pixel text-4xl ${regimeColor(riskState.regime)}`}>
            {riskState.regime}
          </p>
          <p className={`mt-2 font-mono text-xs ${regimeColor(riskState.regime)}`}>
            Volatility: {riskState.volatilityPct.toFixed(2)}%
          </p>
        </MbCard>

        <MbCard coords="X:2 Y:0">
          <p className="text-xs font-mono uppercase tracking-widest text-zinc-200">Collateral Ratio</p>
          <p className="mt-1 text-[11px] text-zinc-600">Dynamic from Rust risk engine</p>
          <p className="mt-3 font-pixel text-4xl text-white">
            {(riskState.ratioBps / 100).toFixed(0)}%
          </p>
        </MbCard>

        <MbCard coords="X:3 Y:0">
          <p className="text-xs font-mono uppercase tracking-widest text-zinc-200">Protocol Stats</p>
          <p className="mt-1 text-[11px] text-zinc-600">Live from vault and token contracts</p>
          <div className="mt-3 space-y-2 font-mono text-sm">
            <p className="text-zinc-200">
              TVL:{" "}
              <span className="text-white">${Number(stats.tvlUsd).toLocaleString()}</span>
            </p>
            <p className="text-zinc-200">
              pUSD Supply:{" "}
              <span className="text-white">{Number(stats.pusdSupply).toLocaleString()}</span>
            </p>
            <p className="text-zinc-200">
              Active Positions:{" "}
              <span className="text-white">{stats.activePositions}</span>
            </p>
          </div>
        </MbCard>
      </div>

      {/* Gauges */}
      <div className="grid gap-4 xl:grid-cols-2">
        <MbCard coords="X:0 Y:1">
          <p className="mb-3 text-xs font-mono uppercase tracking-widest text-zinc-200">Rust Risk Engine</p>
          <RiskGauge regime={riskState.regime} volatilityPct={riskState.volatilityPct} ratioPct={riskState.ratioBps / 100} />
        </MbCard>

        <MbCard coords="X:1 Y:1">
          <p className="mb-3 text-xs font-mono uppercase tracking-widest text-zinc-200">C++ Stability Analyzer</p>
          <StabilityGauge flag={hasResult ? stabilityResult!.flag as 0 | 1 | 2 : 0} hasResult={hasResult} />
        </MbCard>
      </div>

      {/* Charts */}
      <div className="grid gap-4 xl:grid-cols-2">
        <MbCard coords="X:0 Y:2">
          <p className="mb-4 text-xs font-mono uppercase tracking-widest text-zinc-200">DOT Price History (30d)</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={priceHistory}>
                <XAxis dataKey="day" tick={{ fill: "#52525b", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#52525b", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} domain={["dataMin - 0.2", "dataMax + 0.2"]} />
                <Tooltip contentStyle={{ background: "#0d0f13", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "monospace", fontSize: 12 }} />
                <Line type="monotone" dataKey="price" stroke="#00d4b4" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </MbCard>

        <MbCard coords="X:1 Y:2">
          <p className="mb-1 text-xs font-mono uppercase tracking-widest text-zinc-200">Collateral Ratio History (30d)</p>
          <p className="mb-4 text-[11px] text-zinc-600">Step line from EWMA-derived regime transitions</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ratioHistory}>
                <XAxis dataKey="day" tick={{ fill: "#52525b", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#52525b", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} domain={[120, 230]} />
                <Tooltip contentStyle={{ background: "#0d0f13", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "monospace", fontSize: 12 }} />
                <Line type="stepAfter" dataKey="ratioPct" stroke="#a855f7" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </MbCard>
      </div>
    </section>
  );
}
