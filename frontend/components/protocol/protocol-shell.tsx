"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRightLeft, ChartNoAxesCombined, Grid2x2, LockKeyhole, Menu } from "lucide-react";
import { ReactNode, useState } from "react";
import { useProtocol } from "@/components/protocol/protocol-provider";
import { Button } from "@/components/ui/button";
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

function shortAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}


export function ProtocolShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const {
    wallet,
    networkName,
    connectWallet,
    switchNetwork,
    loading,
  } = useProtocol();

  return (
    <div className="min-h-screen bg-[#0f1115] text-zinc-100">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_15%_20%,rgba(168,85,247,0.12),transparent_36%),radial-gradient(circle_at_85%_0%,rgba(236,72,153,0.1),transparent_38%),linear-gradient(to_bottom,#0f1115,#0d1014)]" />

      <div className="flex min-h-screen">
        <aside
          className={cn(
            "fixed z-30 h-screen w-72 border-r border-white/10 bg-[#13161c]/95 p-4 backdrop-blur md:relative md:translate-x-0",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex items-center justify-end pb-4 md:hidden">
            <Button variant="ghost" size="sm" onClick={() => setMobileOpen(false)}>
              Close
            </Button>
          </div>

          <nav className="space-y-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition",
                    active
                      ? "border-purple-400/40 bg-purple-500/15 text-purple-100"
                      : "border-white/10 bg-white/[0.02] text-zinc-300 hover:border-white/20 hover:bg-white/[0.04]"
                  )}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 rounded-md border border-white/10 bg-black/20 p-3">
            <p className="text-xs uppercase tracking-wider text-zinc-400">Wallet</p>
            {wallet ? (
              <div className="mt-2 space-y-1 text-xs text-zinc-300">
                <p>{shortAddress(wallet)}</p>
                <p className="text-zinc-500">{networkName}</p>
              </div>
            ) : (
              <p className="mt-2 text-xs text-zinc-500">Not connected</p>
            )}

            <div className="mt-3 grid gap-2">
              <Button size="sm" className="bg-purple-600 hover:bg-purple-500" disabled={loading} onClick={() => void connectWallet()}>
                {wallet ? "Reconnect" : "Connect Wallet"}
              </Button>
              <Button size="sm" variant="outline" disabled={loading} onClick={() => void switchNetwork()}>
                Switch to Polkadot Hub
              </Button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-white/10 bg-[#11151d]/90 px-4 py-3 md:hidden">
            <p className="text-sm font-semibold tracking-[0.12em] text-purple-300">POLKADOLLAR</p>
            <Button variant="outline" size="sm" onClick={() => setMobileOpen(true)}>
              <Menu className="mr-2 h-4 w-4" />
              Menu
            </Button>
          </div>

          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}

