"use client"

import { useEffect, useState } from "react"

const CHAINS = [
  { name: "POLKADOT RELAY", status: "FINALIZED", paraId: "relay" },
  { name: "ASSET HUB", status: "FINALIZED", paraId: "1000" },
  { name: "HYDRATION", status: "FINALIZED", paraId: "2034" },
  { name: "POLKADOLLAR", status: "ACTIVE", paraId: "3000" },
]

export function StatusCard() {
  const [tick, setTick] = useState(0)
  const [blockNum, setBlockNum] = useState(22481337)

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1)
      setBlockNum((b) => b + 1)
    }, 6000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b-2 border-foreground px-4 py-2">
        <span className="text-[10px] tracking-widest text-muted-foreground uppercase font-mono">
          xcm_nodes.status
        </span>
        <span className="text-[10px] tracking-widest text-muted-foreground font-mono">
          {`BLK:${blockNum.toLocaleString()}`}
        </span>
      </div>
      <div className="flex-1 flex flex-col p-4 gap-0">
        {/* Table header */}
        <div className="grid grid-cols-3 gap-2 border-b border-border pb-2 mb-2">
          <span className="text-[9px] tracking-[0.15em] uppercase text-muted-foreground font-mono">Chain</span>
          <span className="text-[9px] tracking-[0.15em] uppercase text-muted-foreground font-mono">State</span>
          <span className="text-[9px] tracking-[0.15em] uppercase text-muted-foreground font-mono text-right">paraId</span>
        </div>
        {CHAINS.map((chain) => (
          <div
            key={chain.name}
            className="grid grid-cols-3 gap-2 py-2 border-b border-border last:border-none"
          >
            <span className="text-xs font-mono text-foreground">{chain.name}</span>
            <div className="flex items-center gap-2">
              <span
                className="h-1.5 w-1.5"
                style={{
                  backgroundColor: chain.status === "ACTIVE" ? "#00d4b4" : "#ea580c",
                }}
              />
              <span className="text-xs font-mono text-muted-foreground">{chain.status}</span>
            </div>
            <span className="text-xs font-mono text-foreground text-right">{chain.paraId}</span>
          </div>
        ))}
        {/* XCM channel bar */}
        <div className="mt-auto pt-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] tracking-[0.15em] uppercase text-muted-foreground font-mono">
              XCM Channel Capacity
            </span>
            <span className="text-[9px] font-mono text-foreground">{`${60 + (tick % 30)}%`}</span>
          </div>
          <div className="h-2 w-full border border-foreground">
            <div
              className="h-full bg-[#00d4b4] transition-all duration-1000"
              style={{ width: `${60 + (tick % 30)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
