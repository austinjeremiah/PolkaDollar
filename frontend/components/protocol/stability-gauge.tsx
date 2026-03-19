"use client";

type Flag = 0 | 1 | 2;

type Props = {
  flag: Flag;
  hasResult: boolean;
  compact?: boolean;
};

const FLAG_LABELS: Record<Flag, string> = {
  0: "STABLE",
  1: "CAUTION",
  2: "AT_RISK",
};

const FLAG_COLORS: Record<Flag, string> = {
  0: "#10b981",
  1: "#eab308",
  2: "#ef4444",
};

const ANGLES: Record<Flag, number> = {
  0: -75,
  1: 0,
  2: 75,
};

export function StabilityGauge({ flag, hasResult, compact = false }: Props) {
  const size = compact ? 240 : 320;
  
  // Validate flag is a valid Flag (0, 1, or 2); default to 0 if invalid
  const validateFlag = (value: number): Flag => {
    if (!Number.isFinite(value)) return 0;
    const normalized = Math.floor(value);
    if (normalized === 0) return 0;
    if (normalized === 1) return 1;
    if (normalized === 2) return 2;
    return 0;
  };
  
  const activeFlag: Flag = hasResult ? validateFlag(flag) : 0;
  const angle = (ANGLES[activeFlag] * Math.PI) / 180;

  const backLen = 12;
  const tipLen = 108;
  const headLen = 16;
  const headHalfWidth = 7;

  const dirX = Math.sin(angle);
  const dirY = -Math.cos(angle);
  const perpX = -dirY;
  const perpY = dirX;

  const startX = -dirX * backLen;
  const startY = -dirY * backLen;
  const tipX = dirX * tipLen;
  const tipY = dirY * tipLen;
  const baseX = tipX - dirX * headLen;
  const baseY = tipY - dirY * headLen;
  const leftX = baseX + perpX * headHalfWidth;
  const leftY = baseY + perpY * headHalfWidth;
  const rightX = baseX - perpX * headHalfWidth;
  const rightY = baseY - perpY * headHalfWidth;

  const needleColor = hasResult ? FLAG_COLORS[activeFlag] : "#3f3f46";

  return (
    <div>
      <div className="mx-auto" style={{ width: size }}>
        <svg viewBox="0 0 360 220" className="h-auto w-full">
          <defs>
            <linearGradient id="stabilityArc" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>

          <path d="M30,180 A150,150 0 0,1 330,180" fill="none" stroke="#252a35" strokeWidth="24" strokeLinecap="round" />
          <path d="M30,180 A150,150 0 0,1 330,180" fill="none" stroke="url(#stabilityArc)" strokeWidth="18" strokeLinecap="round" opacity={hasResult ? 1 : 0.3} />

          <g transform="translate(180 180)">
            <line x1={startX} y1={startY} x2={tipX} y2={tipY} stroke={needleColor} strokeWidth="4" strokeLinecap="round" />
            <path d={`M${tipX},${tipY} L${leftX},${leftY} L${rightX},${rightY} Z`} fill={needleColor} />
            <circle cx="0" cy="0" r="8" fill={hasResult ? "#fafafa" : "#3f3f46"} />
          </g>

          <text x="32" y="202" fill="#6b7280" fontSize="12">STABLE</text>
          <text x="138" y="96" fill="#6b7280" fontSize="12">CAUTION</text>
          <text x="268" y="202" fill="#6b7280" fontSize="12">AT_RISK</text>
        </svg>
      </div>

      <div className="mt-2 rounded-md border border-white/10 bg-black/20 p-2">
        <p className="text-xs uppercase tracking-wide text-zinc-500">Status Flag</p>
        <p className="mt-1 font-mono" style={{ color: hasResult ? FLAG_COLORS[activeFlag] : "#52525b" }}>
          {hasResult ? FLAG_LABELS[activeFlag] : "—"}
        </p>
      </div>

      <p className="mt-3 text-center text-xs text-zinc-600">
        Stability computed on-chain by{" "}
        <span className="text-pink-400">C++ contract on PolkaVM</span>
        {" "}— called from Solidity in a single atomic transaction
      </p>
    </div>
  );
}
