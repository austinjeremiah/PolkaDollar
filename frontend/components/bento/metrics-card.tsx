"use client"

import { useEffect, useState } from "react"

interface ScrambleNumberProps {
  target: string
  label: string
  delay?: number
  accent?: boolean
}

function ScrambleNumber({ target, label, delay = 0, accent = false }: ScrambleNumberProps) {
  const [display, setDisplay] = useState(target.replace(/[0-9]/g, "0"))

  useEffect(() => {
    const timeout = setTimeout(() => {
      let iterations = 0
      const maxIterations = 20

      const interval = setInterval(() => {
        if (iterations >= maxIterations) {
          setDisplay(target)
          clearInterval(interval)
          return
        }

        setDisplay(
          target
            .split("")
            .map((char, i) => {
              if (!/[0-9]/.test(char)) return char
              if (iterations > maxIterations - 5 && i < iterations - (maxIterations - 5)) return char
              return String(Math.floor(Math.random() * 10))
            })
            .join("")
        )
        iterations++
      }, 50)

      return () => clearInterval(interval)
    }, delay)

    return () => clearTimeout(timeout)
  }, [target, delay])

  return (
    <div className="flex flex-col gap-0.5">
      <span
        className={`text-3xl lg:text-4xl font-mono font-bold tracking-tight ${accent ? "text-[#00d4b4]" : "text-foreground"}`}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {display}
      </span>
      <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-mono">
        {label}
      </span>
    </div>
  )
}

export function MetricsCard() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b-2 border-foreground px-4 py-2">
        <span className="text-[10px] tracking-widest text-muted-foreground uppercase font-mono">
          protocol.constants
        </span>
        <span className="inline-block h-2 w-2 bg-[#ea580c]" />
      </div>
      <div className="flex-1 flex flex-col justify-center gap-5 p-6">
        <ScrambleNumber target="0.94" label="EWMA_LAMBDA (λ)" delay={500} accent />
        <ScrambleNumber target="130%" label="COLLAT_FLOOR_PCT" delay={800} />
        <ScrambleNumber target="1e12" label="FIXED_POINT_SCALE" delay={1100} />
        <ScrambleNumber target="3" label="XCM_DEST_CHAINS" delay={1400} />
      </div>
    </div>
  )
}
