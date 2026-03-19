"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRightLeft, ChartNoAxesCombined, Grid2x2, LockKeyhole, Menu, Minus, Move, X } from "lucide-react";
import { ReactNode, useState } from "react";
import { useProtocol } from "@/components/protocol/protocol-provider";
import { Button } from "@/components/ui/button";
import { DotPattern } from "@/components/ui/dot-pattern";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Grid2x2 },
  { href: "/vault", label: "Vault", icon: LockKeyhole },
  { href: "/bridge", label: "Bridge", icon: ArrowRightLeft },
  { href: "/risk-monitor", label: "Risk Monitor", icon: ChartNoAxesCombined },
];


export function ProtocolShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { wallet, networkName, connectWallet, disconnectWallet, loading } = useProtocol();

  return (
    <div className="relative min-h-screen text-zinc-100">
      <DotPattern className="fixed inset-0 -z-10 text-zinc-500/50" width={20} height={20} cr={1.2} />

      {/* Top navbar */}
      <header className="sticky top-0 z-30 border-b border-white/[0.18] bg-[#0d0f13]">
        {/* Chrome bar */}
        <div className="flex items-center justify-between border-b border-white/[0.18] px-4 py-1.5">
          <div className="flex items-center gap-2 text-zinc-600">
            <Minus className="h-3 w-3" />
            <Move className="h-3 w-3" />
          </div>
          <span className="font-mono text-[10px] tracking-widest text-zinc-600">POLKADOLLAR</span>
          <span className="font-mono text-[10px] tracking-widest text-zinc-600">X:0 Y:0</span>
        </div>

        {/* Nav row */}
        <div className="flex items-center justify-between px-4 py-2">
          {/* Nav links - desktop */}
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-sm border px-3 py-1.5 font-mono text-xs tracking-wide transition",
                    active
                      ? "border-white/[0.18] bg-black text-zinc-100"
                      : "border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:border-white/[0.18] hover:bg-black hover:text-zinc-200"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Wallet section - desktop */}
          <div className="hidden items-center gap-2 md:flex">
            {wallet ? (
              <div className="rounded-sm border border-white/[0.18] px-3 py-1.5">
                <p className="font-mono text-xs text-zinc-200">{wallet}</p>
                <p className="font-mono text-[10px] text-zinc-500">{networkName}</p>
              </div>
            ) : (
              <span className="font-mono text-xs text-zinc-500">Not connected</span>
            )}
            <Button
              size="sm"
              className={`rounded-sm bg-black border border-white/[0.18] font-mono text-xs tracking-wide hover:bg-zinc-900 ${wallet ? "text-red-400" : "text-emerald-400"}`}
              disabled={loading}
              onClick={() => wallet ? disconnectWallet() : void connectWallet()}
            >
              {wallet ? "Disconnect" : "Connect Wallet"}
            </Button>
          </div>

          {/* Mobile menu button */}
          <button
            className="rounded-sm border border-white/[0.18] p-1.5 text-zinc-400 md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex flex-col bg-[#0d0f13]">
          <div className="flex items-center justify-between border-b border-white/[0.18] px-4 py-3">
            <span className="font-mono text-xs tracking-widest text-zinc-400">MENU</span>
            <button onClick={() => setMobileOpen(false)}>
              <X className="h-4 w-4 text-zinc-400" />
            </button>
          </div>
          <nav className="flex flex-col gap-1 p-3">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-sm border px-3 py-2.5 font-mono text-sm tracking-wide transition",
                    active
                      ? "border-white/[0.18] bg-black text-zinc-100"
                      : "border-white/[0.08] text-zinc-400"
                  )}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="m-3 rounded-sm border border-white/[0.18] p-3">
            {wallet ? (
              <div className="mb-3">
                <p className="font-mono text-xs text-zinc-200">{wallet}</p>
                <p className="font-mono text-[11px] text-zinc-500">{networkName}</p>
              </div>
            ) : (
              <p className="mb-3 font-mono text-xs text-zinc-500">Not connected</p>
            )}
            <Button size="sm" className="w-full rounded-sm bg-black border border-white/[0.18] font-mono text-xs text-zinc-100 hover:bg-zinc-900" disabled={loading} onClick={() => void connectWallet()}>
              {wallet ? "Disconnect" : "Connect Wallet"}
            </Button>
          </div>
        </div>
      )}

      <main className="p-4 md:p-6">{children}</main>
    </div>
  );
}
