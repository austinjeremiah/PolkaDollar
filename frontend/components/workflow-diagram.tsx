"use client"

import { motion } from "framer-motion"
import { useEffect, useState } from "react"

const LEFT_LABELS = ["FetchPrice", "UpdateFeed", "PushPrice"]
const RIGHT_LABELS = ["AssessRisk", "CheckVault", "MintBurn"]

const PILL_W = 104
const PILL_H = 26
const LEFT_X = 40
const RIGHT_X = 656
const CENTER_X = 400
const CENTER_Y = 100
const PILL_Y_START = 24
const PILL_GAP = 58

function PillLabel({
  label,
  x,
  y,
  delay,
}: {
  label: string
  x: number
  y: number
  delay: number
}) {
  return (
    <motion.g
      initial={{ opacity: 0, x: x > 400 ? 20 : -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      <rect
        x={x}
        y={y}
        width={PILL_W}
        height={PILL_H}
        rx={PILL_H / 2}
        fill="none"
        stroke="hsl(var(--foreground))"
        strokeWidth={1.5}
      />
      <text
        x={x + PILL_W / 2}
        y={y + PILL_H / 2 + 5}
        textAnchor="middle"
        fill="hsl(var(--foreground))"
        fontSize={11}
        fontFamily="var(--font-mono), monospace"
        fontWeight={500}
        letterSpacing="0.05em"
      >
        {label}
      </text>
    </motion.g>
  )
}

export function WorkflowDiagram() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="h-[200px] w-full" />
  }

  return (
    <div className="relative w-full max-w-[800px] mx-auto">
      <svg
        viewBox="0 0 800 200"
        className="w-full h-auto"
        role="img"
        aria-label="Workflow diagram: FetchPrice, UpdateFeed, PushPrice → PolkaVM → AssessRisk, CheckVault, MintBurn"
      >
        {/* Left lines: right edge of pill → center */}
        {LEFT_LABELS.map((_, i) => {
          const pillY = PILL_Y_START + i * PILL_GAP
          return (
            <motion.line
              key={`left-line-${i}`}
              x1={LEFT_X + PILL_W}
              y1={pillY + PILL_H / 2}
              x2={CENTER_X - 40}
              y2={CENTER_Y}
              stroke="hsl(var(--border))"
              strokeWidth={1}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 + i * 0.1 }}
            />
          )
        })}

        {/* Right lines: center → left edge of pill */}
        {RIGHT_LABELS.map((_, i) => {
          const pillY = PILL_Y_START + i * PILL_GAP
          return (
            <motion.line
              key={`right-line-${i}`}
              x1={CENTER_X + 40}
              y1={CENTER_Y}
              x2={RIGHT_X}
              y2={pillY + PILL_H / 2}
              stroke="hsl(var(--border))"
              strokeWidth={1}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 + i * 0.1 }}
            />
          )
        })}

        {/* Data packets: left pills → center */}
        {LEFT_LABELS.map((_, i) => {
          const pillY = PILL_Y_START + i * PILL_GAP
          return (
            <motion.circle
              key={`left-packet-${i}`}
              r={3}
              fill="#ea580c"
              animate={{
                cx: [LEFT_X + PILL_W, CENTER_X - 40],
                cy: [pillY + PILL_H / 2, CENTER_Y],
              }}
              transition={{
                duration: 1.8,
                delay: 0.8 + i * 0.6,
                repeat: Infinity,
                repeatDelay: 3,
                ease: "linear",
              }}
            />
          )
        })}

        {/* Data packets: center → right pills */}
        {RIGHT_LABELS.map((_, i) => {
          const pillY = PILL_Y_START + i * PILL_GAP
          return (
            <motion.circle
              key={`right-packet-${i}`}
              r={3}
              fill="#ea580c"
              animate={{
                cx: [CENTER_X + 40, RIGHT_X],
                cy: [CENTER_Y, pillY + PILL_H / 2],
              }}
              transition={{
                duration: 1.8,
                delay: 1.2 + i * 0.6,
                repeat: Infinity,
                repeatDelay: 3,
                ease: "linear",
              }}
            />
          )
        })}

        {/* Left pill labels */}
        {LEFT_LABELS.map((label, i) => (
          <PillLabel
            key={`left-${label}`}
            label={label}
            x={LEFT_X}
            y={PILL_Y_START + i * PILL_GAP}
            delay={0.1 + i * 0.1}
          />
        ))}

        {/* Right pill labels */}
        {RIGHT_LABELS.map((label, i) => (
          <PillLabel
            key={`right-${label}`}
            label={label}
            x={RIGHT_X}
            y={PILL_Y_START + i * PILL_GAP}
            delay={0.1 + i * 0.1}
          />
        ))}

        {/* Center logo square */}
        <motion.g
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <rect
            x={CENTER_X - 36}
            y={CENTER_Y - 36}
            width={72}
            height={72}
            fill="hsl(var(--muted))"
            stroke="hsl(var(--border))"
            strokeWidth={1.5}
          />
          <line x1={CENTER_X} y1={CENTER_Y - 18} x2={CENTER_X} y2={CENTER_Y + 18} stroke="hsl(var(--foreground))" strokeWidth={3} />
          <line x1={CENTER_X - 18} y1={CENTER_Y} x2={CENTER_X + 18} y2={CENTER_Y} stroke="hsl(var(--foreground))" strokeWidth={3} />
          <line x1={CENTER_X - 12} y1={CENTER_Y - 12} x2={CENTER_X + 12} y2={CENTER_Y + 12} stroke="hsl(var(--foreground))" strokeWidth={2} />
          <line x1={CENTER_X + 12} y1={CENTER_Y - 12} x2={CENTER_X - 12} y2={CENTER_Y + 12} stroke="hsl(var(--foreground))" strokeWidth={2} />
          <circle cx={CENTER_X} cy={CENTER_Y} r={30} fill="none" stroke="#ea580c" strokeWidth={1}>
            <animate attributeName="r" values="30;34;30" dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;0.2;0.6" dur="3s" repeatCount="indefinite" />
          </circle>
        </motion.g>
      </svg>
    </div>
  )
}
