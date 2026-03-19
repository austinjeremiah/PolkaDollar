"use client"

import { useEffect, useState } from "react"

// Simulated EWMA variance calculation cycle
const PRICES = [1.58, 1.61, 1.57, 1.54, 1.59, 1.62, 1.55, 1.53]
const LAMBDA = 0.94

function buildCycle(): string[] {
  const lines: string[] = []
  let variance = 0

  lines.push("> POLKADOLLAR RISK ENGINE — PolkaVM")
  lines.push("> initializing EWMA variance estimator...")
  lines.push(`> λ = ${LAMBDA}  |  scale = 1e12`)
  lines.push("> ──────────────────────────────────")

  PRICES.forEach((price, i) => {
    if (i === 0) {
      lines.push(`> t=${i}  price = $${price.toFixed(4)}  [seed]`)
      return
    }
    const ret = Math.abs((price - PRICES[i - 1]) / PRICES[i - 1])
    variance = variance * LAMBDA + ret * ret * (1 - LAMBDA)
    const sigma = Math.sqrt(variance) * 100
    const regime =
      sigma < 3.16 ? "LOW" : sigma < 6.32 ? "MEDIUM" : sigma < 9.49 ? "HIGH" : "EXTREME"
    lines.push(`> t=${i}  price = $${price.toFixed(4)}`)
    lines.push(`>    r  = ${(ret * 100).toFixed(4)}%`)
    lines.push(`>    σ² = ${variance.toExponential(4)}`)
    lines.push(`>    σ  = ${sigma.toFixed(4)}%  →  regime: ${regime}`)
  })

  const finalSigma = Math.sqrt(variance) * 100
  const ratio =
    finalSigma < 3.16 ? 130 : finalSigma < 6.32 ? 150 : finalSigma < 9.49 ? 180 : 220
  lines.push("> ──────────────────────────────────")
  lines.push(`> final σ     = ${finalSigma.toFixed(4)}%`)
  lines.push(`> collateral  = ${ratio}%`)
  lines.push("> status: RISK ENGINE OPERATIONAL")
  lines.push("> ──────────────────────────────────")

  return lines
}

const LOG_LINES = buildCycle()

export function TerminalCard() {
  const [lines, setLines] = useState<string[]>([])
  const [currentLine, setCurrentLine] = useState(0)

  useEffect(() => {
    setLines([LOG_LINES[0]])

    const interval = setInterval(() => {
      setCurrentLine((prev) => {
        const next = prev + 1
        if (next >= LOG_LINES.length) {
          setLines([])
          return 0
        }
        setLines((l) => [...l.slice(-10), LOG_LINES[next]])
        return next
      })
    }, 500)

    return () => clearInterval(interval)
  }, [])

  const getColor = (line: string) => {
    if (line.includes("regime:")) {
      if (line.includes("LOW")) return "#00d4b4"
      if (line.includes("MEDIUM")) return "#facc15"
      if (line.includes("HIGH")) return "#f97316"
      if (line.includes("EXTREME")) return "#ef4444"
    }
    if (line.includes("collateral")) return "#00d4b4"
    if (line.includes("OPERATIONAL")) return "#00d4b4"
    if (line.includes("──")) return "#3f3f46"
    if (line.startsWith(">    ")) return "#a1a1aa"
    return "#e4e4e7"
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 border-b border-white/[0.18] px-4 py-2 bg-[#0d0f13]">
        <span className="h-2 w-2 bg-[#ea580c]" />
        <span className="h-2 w-2 bg-zinc-600" />
        <span className="h-2 w-2 border border-zinc-600" />
        <span className="ml-auto font-mono text-[10px] tracking-widest text-zinc-600 uppercase">
          risk.engine.sys
        </span>
      </div>
      <div className="flex-1 bg-[#0a0b0e] p-4 overflow-hidden">
        <div className="flex flex-col gap-0.5">
          {lines.map((line, i) => (
            <span
              key={`${currentLine}-${i}`}
              className="text-sm font-mono block"
              style={{
                color: getColor(line),
                opacity: i === lines.length - 1 ? 1 : i >= lines.length - 3 ? 0.8 : 0.5,
              }}
            >
              {line}
            </span>
          ))}
          <span className="text-sm font-mono text-[#00d4b4] animate-blink">{"_"}</span>
        </div>
      </div>
    </div>
  )
}
