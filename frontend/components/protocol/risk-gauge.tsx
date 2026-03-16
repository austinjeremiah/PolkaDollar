"use client";

import { motion } from "framer-motion";

type Props = {
  regime: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  volatilityPct: number;
  ratioPct: number;
  compact?: boolean;
};

const ANGLES: Record<Props["regime"], number> = {
  LOW: -78,
  MEDIUM: -28,
  HIGH: 22,
  EXTREME: 74,
};

export function RiskGauge({ regime, volatilityPct, ratioPct, compact = false }: Props) {
  const size = compact ? 240 : 320;

  return (
    <div className="rounded-lg border border-white/10 bg-[#151922] p-4">
      <div className="mx-auto" style={{ width: size }}>
        <svg viewBox="0 0 360 220" className="h-auto w-full">
          <defs>
            <linearGradient id="riskArc" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="35%" stopColor="#eab308" />
              <stop offset="70%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>

          <path d="M30,180 A150,150 0 0,1 330,180" fill="none" stroke="#252a35" strokeWidth="24" strokeLinecap="round" />
          <path d="M30,180 A150,150 0 0,1 330,180" fill="none" stroke="url(#riskArc)" strokeWidth="18" strokeLinecap="round" />

          <g transform="translate(180 180)">
            <motion.g animate={{ rotate: ANGLES[regime] }} transition={{ type: "spring", stiffness: 90, damping: 14 }}>
              <line x1="0" y1="0" x2="0" y2="-122" stroke="#d4d4d8" strokeWidth="4" strokeLinecap="round" />
            </motion.g>
            <circle cx="0" cy="0" r="8" fill="#fafafa" />
          </g>

          <text x="44" y="202" fill="#6b7280" fontSize="12">LOW</text>
          <text x="122" y="106" fill="#6b7280" fontSize="12">MEDIUM</text>
          <text x="220" y="106" fill="#6b7280" fontSize="12">HIGH</text>
          <text x="292" y="202" fill="#6b7280" fontSize="12">EXTREME</text>
        </svg>
      </div>

      <div className="mt-2 grid gap-2 text-sm md:grid-cols-2">
        <div className="rounded-md border border-white/10 bg-black/20 p-2">
          <p className="text-xs uppercase tracking-wide text-zinc-500">EWMA Volatility</p>
          <p className="mt-1 font-mono tabular-nums text-zinc-100">{volatilityPct.toFixed(2)}%</p>
        </div>
        <div className="rounded-md border border-white/10 bg-black/20 p-2">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Required Ratio</p>
          <p className="mt-1 font-mono tabular-nums text-zinc-100">{ratioPct.toFixed(0)}%</p>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-zinc-600">
        Risk computed on-chain by{" "}
        <span className="text-purple-400">Rust contract on PolkaVM</span>
        {" "}— called from Solidity in a single atomic transaction
      </p>
    </div>
  );
}
