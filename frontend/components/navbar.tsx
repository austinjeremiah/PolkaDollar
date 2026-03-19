"use client"

import Link from "next/link"
import { motion } from "framer-motion"

export function Navbar() {
  const links = [
    { label: "Home", href: "/" },
    { label: "Dashboard", href: "/dashboard" },
    { label: "Vault", href: "/vault" },
    { label: "Bridge", href: "/bridge" },
    { label: "Risk Monitor", href: "/risk-monitor" },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-full px-4 pt-4 lg:px-6 lg:pt-6"
    >
      <nav className="w-full border border-foreground/20 bg-background/80 backdrop-blur-sm px-6 py-3 lg:px-8">
        <div className="flex items-center justify-center">
          {/* Centered nav links */}
          <div className="hidden md:flex items-center gap-8">
            {links.map((link, i) => (
              <motion.div
                key={link.label}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="text-xs font-mono tracking-widest uppercase"
              >
                <Link href={link.href} className="text-muted-foreground hover:text-foreground transition-colors duration-200">
                  {link.label}
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </nav>
    </motion.div>
  )
}
