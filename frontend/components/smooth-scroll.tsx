"use client"

import { useEffect } from "react"
import Lenis from "@studio-freight/lenis"

export function SmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({ duration: 1.2 })

    const raf = (time: number) => {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    const rafId = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(rafId)
      lenis.destroy()
    }
  }, [])

  return null
}
