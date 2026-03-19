"use client"

import { useEffect, useState, useRef } from "react"
import { motion, useInView } from "framer-motion"

const ease = [0.22, 1, 0.36, 1] as const

/* ── scramble text reveal ── */
function ScrambleText({ text, className }: { text: string; className?: string }) {
  const [display, setDisplay] = useState(text)
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: "-50px" })
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_./:"

  useEffect(() => {
    if (!inView) return
    let iteration = 0
    const interval = setInterval(() => {
      setDisplay(
        text
          .split("")
          .map((char, i) => {
            if (char === " ") return " "
            if (i < iteration) return text[i]
            return chars[Math.floor(Math.random() * chars.length)]
          })
          .join("")
      )
      iteration += 0.5
      if (iteration >= text.length) {
        setDisplay(text)
        clearInterval(interval)
      }
    }, 30)
    return () => clearInterval(interval)
  }, [inView, text])

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  )
}

/* ── blinking cursor ── */
function BlinkDot() {
  return <span className="inline-block h-2 w-2 bg-[#ea580c] animate-blink" />
}

/* ── live block counter ── */
function BlockCounter() {
  const [block, setBlock] = useState(22481337)

  useEffect(() => {
    const base = 22481337 + Math.floor(Math.random() * 100)
    setBlock(base)
    const interval = setInterval(() => setBlock((b) => b + 1), 6000)
    return () => clearInterval(interval)
  }, [])

  return (
    <span className="font-mono text-[#ea580c]" style={{ fontVariantNumeric: "tabular-nums" }}>
      #{block.toLocaleString()}
    </span>
  )
}

/* ── stat block ── */
const STATS = [
  { label: "EWMA_LAMBDA", value: "0.94" },
  { label: "COLLAT_FLOOR", value: "130%" },
  { label: "FIXED_SCALE", value: "1e12" },
  { label: "XCM_DESTS", value: "3" },
]

function StatBlock({ label, value, index }: { label: string; value: string; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ delay: 0.15 + index * 0.08, duration: 0.5, ease }}
      className="flex flex-col gap-1 border-2 border-foreground px-4 py-3"
    >
      <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-mono">
        {label}
      </span>
      <span className="text-xl lg:text-2xl font-mono font-bold tracking-tight text-[#00d4b4]">
        <ScrambleText text={value} />
      </span>
    </motion.div>
  )
}

/* ── contract code panel ── */
const CODE_LINES = [
  { text: "> POLKADOLLAR :: risk_engine.rs",     color: "#e4e4e7" },
  { text: "> ──────────────────────────────────", color: "#3f3f46" },
  { text: "> fn assess_collateral(",              color: "#a1a1aa" },
  { text: ">   dot_price: u128,",                 color: "#a1a1aa" },
  { text: ">   vault_dot: u128,",                 color: "#a1a1aa" },
  { text: ">   debt_pusd: u128,",                 color: "#a1a1aa" },
  { text: ">   variance: u128,",                  color: "#a1a1aa" },
  { text: "> ) -> CollateralState {",             color: "#a1a1aa" },
  { text: ">   let ratio =",                      color: "#e4e4e7" },
  { text: ">     dot_price * vault_dot / debt;",  color: "#e4e4e7" },
  { text: ">   match ratio {",                    color: "#e4e4e7" },
  { text: ">     r if r >= 220 => SAFE,",         color: "#00d4b4" },
  { text: ">     r if r >= 180 => HIGH,",         color: "#facc15" },
  { text: ">     r if r >= 150 => MEDIUM,",       color: "#f97316" },
  { text: ">     _ => LIQUIDATE",                 color: "#ef4444" },
  { text: ">   }",                                color: "#e4e4e7" },
  { text: "> }",                                  color: "#e4e4e7" },
  { text: "> ──────────────────────────────────", color: "#3f3f46" },
  { text: "> status: CONTRACT DEPLOYED",          color: "#00d4b4" },
]

function ContractPanel() {
  const [lines, setLines] = useState<typeof CODE_LINES>([])
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    setLines([CODE_LINES[0]])
    const interval = setInterval(() => {
      setIdx((prev) => {
        const next = prev + 1
        if (next >= CODE_LINES.length) {
          setLines([])
          return 0
        }
        setLines((l) => [...l.slice(-14), CODE_LINES[next]])
        return next
      })
    }, 400)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col h-full min-h-[400px] bg-[#0a0b0e]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.1] bg-[#0d0f13]">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 bg-[#ea580c]" />
          <span className="h-2 w-2 bg-zinc-600" />
          <span className="h-2 w-2 border border-zinc-600" />
        </div>
        <span className="font-mono text-[10px] tracking-widest text-zinc-600 uppercase">
          risk_engine.rs
        </span>
        <span className="font-mono text-[10px] tracking-widest text-zinc-600">PolkaVM</span>
      </div>
      <div className="h-[360px] p-4 overflow-hidden">
        <div className="flex flex-col gap-0.5">
          {lines.map((line, i) => (
            <span
              key={`${idx}-${i}`}
              className="text-xs font-mono block"
              style={{
                color: line.color,
                opacity: i === lines.length - 1 ? 1 : i >= lines.length - 3 ? 0.8 : 0.5,
              }}
            >
              {line.text}
            </span>
          ))}
          <span className="text-xs font-mono text-[#00d4b4] animate-blink">{"_"}</span>
        </div>
      </div>
    </div>
  )
}

/* ── main about section ── */
export function AboutSection() {
  return (
    <section className="w-full px-6 py-20 lg:px-12">
      {/* Section label */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5, ease }}
        className="flex items-center gap-4 mb-8"
      >
        <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-mono">
          {"// SECTION: ABOUT_POLKADOLLAR"}
        </span>
        <div className="flex-1 border-t border-border" />
        <BlinkDot />
        <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-mono">
          005
        </span>
      </motion.div>

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-0 border-2 border-foreground">
        {/* Left: Contract code terminal */}
        <motion.div
          initial={{ opacity: 0, x: -30, filter: "blur(6px)" }}
          whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease }}
          className="relative w-full lg:w-1/2 border-b-2 lg:border-b-0 lg:border-r-2 border-foreground overflow-hidden"
        >
          <ContractPanel />
        </motion.div>

        {/* Right: Content */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, delay: 0.1, ease }}
          className="flex flex-col w-full lg:w-1/2"
        >
          {/* Header bar */}
          <div className="flex items-center justify-between px-5 py-3 border-b-2 border-foreground">
            <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-mono">
              PROTOCOL.md
            </span>
            <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-mono">
              v1.0.0
            </span>
          </div>

          {/* Content body */}
          <div className="flex-1 flex flex-col justify-between px-5 py-6 lg:py-8">
            <div className="flex flex-col gap-6">
              <motion.h2
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ duration: 0.5, delay: 0.2, ease }}
                className="text-2xl lg:text-3xl font-mono font-bold tracking-tight uppercase text-balance"
              >
                DOT collateral →{" "}
                <br />
                <span className="text-[#00d4b4]">pUSD synthetic dollar</span>
              </motion.h2>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ delay: 0.3, duration: 0.5, ease }}
                className="flex flex-col gap-4"
              >
                <p className="text-xs lg:text-sm font-mono text-muted-foreground leading-relaxed">
                  Lock DOT into a vault contract deployed on PolkaVM. The risk engine reads on-chain
                  price feeds, computes an EWMA variance estimate with λ=0.94, and derives a
                  regime-adjusted collateral floor. Minimum 130% collateral at LOW volatility,
                  up to 220% at EXTREME. pUSD is minted only within the safe ratio band.
                </p>
                <p className="text-xs lg:text-sm font-mono text-muted-foreground leading-relaxed">
                  Cross-chain transfers use XCM v4. The vault contract is written in Rust,
                  the C++ stability gauge runs as a separate ink! contract. All arithmetic is
                  fixed-point at 1e12 precision to avoid floating-point divergence across
                  RISC-V execution environments.
                </p>
              </motion.div>

              {/* Block line */}
              <motion.div
                initial={{ opacity: 0, scaleX: 0.8 }}
                whileInView={{ opacity: 1, scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4, duration: 0.5, ease }}
                style={{ transformOrigin: "left" }}
                className="flex items-center gap-3 py-3 border-t-2 border-b-2 border-foreground"
              >
                <span className="h-1.5 w-1.5 bg-[#ea580c]" />
                <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-mono">
                  RELAY_BLOCK:
                </span>
                <BlockCounter />
              </motion.div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-0 mt-6">
              {STATS.map((stat, i) => (
                <StatBlock key={stat.label} {...stat} index={i} />
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
