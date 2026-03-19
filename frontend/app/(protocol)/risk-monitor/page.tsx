"use client";

import { Area, AreaChart, CartesianGrid, Line, LineChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Minus, Move } from "lucide-react";
import { RiskGauge } from "@/components/protocol/risk-gauge";
import { useProtocol } from "@/components/protocol/protocol-provider";


function MbCard({ children, coords = "X:0 Y:0", className = "" }: { children: React.ReactNode; coords?: string; className?: string }) {
  return (
    <div className={`rounded-sm border border-white/[0.18] bg-[#0d0f13] ${className}`}>
      <div className="flex items-center justify-between border-b border-white/[0.18] px-3 py-2">
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

export default function RiskMonitorPage() {
  const { riskState, ratioHistory, priceHistory } = useProtocol();

  const overlayData = ratioHistory.map((r, index) => ({
    day: r.day,
    ratioPct: r.ratioPct,
    price: priceHistory[index]?.price ?? null,
  }));

  const chartTooltip = { background: "#0d0f13", border: "1px solid rgba(255,255,255,0.18)", fontFamily: "monospace", fontSize: 11 };
  const tickStyle = { fill: "#52525b", fontSize: 10, fontFamily: "monospace" };

  return (
    <section className="space-y-5">
      <div>
        <h1 className="font-pixel text-5xl sm:text-6xl lg:text-7xl tracking-tight text-white">RISK MONITOR</h1>
        <p className="mt-1 text-sm text-zinc-500">Rust PolkaVM regime engine telemetry and collateral policy behavior.</p>
      </div>

      {/* Top stat cards */}
      <div className="grid gap-4 xl:grid-cols-3">
        <MbCard coords="X:0 Y:0">
          <p className="font-mono text-xs uppercase tracking-widest text-zinc-200">Volatility</p>
          <p className="mt-1 text-[11px] text-zinc-600">EWMA daily volatility</p>
          <p className="mt-3 font-pixel text-4xl text-white">{riskState.volatilityPct.toFixed(2)}%</p>
          <p className="mt-2 font-mono text-[10px] text-zinc-600">Computed via Rust risk engine state transitions</p>
          <div className="mt-4 rounded-sm border border-white/[0.08] bg-black/30 p-4 space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">EWMA Formula</p>
            <p className="font-pixel text-xl text-zinc-100">σ²ₜ = λ·σ²ₜ₋₁ + (1−λ)·r²ₜ</p>
            <p className="font-pixel text-base text-zinc-400">λ = 0.94</p>
            <p className="font-pixel text-base text-zinc-400">σ = √σ² × 100</p>
          </div>
        </MbCard>

        <MbCard coords="X:1 Y:0">
          <p className="mb-3 font-mono text-xs uppercase tracking-widest text-zinc-200">Current Regime</p>
          <p className="mb-2 text-[11px] text-zinc-600">Threshold-classified risk bucket</p>
          <RiskGauge regime={riskState.regime} volatilityPct={riskState.volatilityPct} ratioPct={riskState.ratioBps / 100} compact />
        </MbCard>

        <MbCard coords="X:2 Y:0">
          <p className="font-mono text-xs uppercase tracking-widest text-zinc-200">Collateral Ratio</p>
          <p className="mt-1 text-[11px] text-zinc-600">{riskState.regime} regime → {(riskState.ratioBps / 100).toFixed(0)}%</p>
          <p className="mt-3 font-pixel text-4xl text-white">{(riskState.ratioBps / 100).toFixed(0)}%</p>
          <p className="mt-2 font-mono text-[10px] text-zinc-600">Range: 130% to 220%</p>
          <div className="mt-4 rounded-sm border border-white/[0.08] bg-black/30 p-4 space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Regime Map</p>
            <p className="font-pixel text-base text-zinc-400">LOW → <span className="text-emerald-400">130%</span></p>
            <p className="font-pixel text-base text-zinc-400">MEDIUM → <span className="text-yellow-400">150%</span></p>
            <p className="font-pixel text-base text-zinc-400">HIGH → <span className="text-orange-400">180%</span></p>
            <p className="font-pixel text-base text-zinc-400">EXTREME → <span className="text-red-400">220%</span></p>
          </div>
        </MbCard>
      </div>

      {/* Charts */}
      <div className="grid gap-4 xl:grid-cols-2">
        <MbCard coords="X:0 Y:1">
          <p className="mb-1 font-mono text-xs uppercase tracking-widest text-zinc-200">Volatility Over Time</p>
          <p className="mb-4 text-[11px] text-zinc-600">EWMA area chart with regime boundaries</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ratioHistory}>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" tick={tickStyle} axisLine={false} tickLine={false} />
                <YAxis tick={tickStyle} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={chartTooltip} />
                <Area type="monotone" dataKey="volatilityPct" stroke="#00d4b4" fill="#00d4b411" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </MbCard>

        <MbCard coords="X:1 Y:1">
          <p className="mb-1 font-mono text-xs uppercase tracking-widest text-zinc-200">DOT Price + Ratio Overlay</p>
          <p className="mb-4 text-[11px] text-zinc-600">Dual-axis view of market and policy response</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={overlayData}>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" tick={tickStyle} axisLine={false} tickLine={false} />
                <YAxis yAxisId="price" orientation="left" tick={tickStyle} axisLine={false} tickLine={false} />
                <YAxis yAxisId="ratio" orientation="right" tick={tickStyle} axisLine={false} tickLine={false} domain={[120, 230]} />
                <Tooltip contentStyle={chartTooltip} />
                <Legend wrapperStyle={{ fontFamily: "monospace", fontSize: 11, color: "#71717a" }} />
                <Line yAxisId="price" type="monotone" dataKey="price" stroke="#00d4b4" strokeWidth={2} dot={false} name="DOT Price" />
                <Line yAxisId="ratio" type="stepAfter" dataKey="ratioPct" stroke="#818cf8" strokeWidth={2} dot={false} name="Collateral Ratio" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </MbCard>
      </div>

      {/* Risk engine details */}
      <MbCard coords="X:0 Y:2">
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-sm border border-purple-500/30 bg-black px-2 py-0.5 font-mono text-[10px] tracking-widest text-purple-400">RUST / POLKAVM</span>
          <p className="font-mono text-xs uppercase tracking-widest text-zinc-200">On-Chain Risk Engine</p>
        </div>
        <p className="mb-4 text-[11px] text-zinc-600">Cross-VM computation — Solidity invokes Rust in a single atomic transaction</p>

        <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 mb-4">
          <Detail label="Model" value="EWMA variance estimator" />
          <Detail label="Decay factor (λ)" value="0.94 per price update" />
          <Detail label="Regime T1 → LOW" value="σ < 3.16% → 130% ratio" />
          <Detail label="Regime T2 → MEDIUM" value="σ < 6.32% → 150% ratio" />
          <Detail label="Regime T3 → HIGH" value="σ < 9.49% → 180% ratio" />
          <Detail label="Regime T4 → EXTREME" value="σ ≥ 9.49% → 220% ratio" />
          <Detail label="Liquidation threshold" value="Health factor < 1.2" />
          <Detail label="Oracle max age" value="1 800 s (30 min)" />
        </div>



      </MbCard>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="font-mono text-xs text-zinc-200">{value}</p>
    </div>
  );
}
