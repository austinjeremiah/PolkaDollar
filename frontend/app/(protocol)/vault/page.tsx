"use client";

import { FormEvent, useMemo, useState } from "react";
import { useProtocol } from "@/components/protocol/protocol-provider";
import { AlertTriangle, ArrowRight, Check, Minus, Move, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const EXPLORER_BASE = (process.env.NEXT_PUBLIC_EXPLORER_URL || "https://blockscout-testnet.polkadot.io/").replace(/\/$/, "");

function healthClass(hf: number) {
  if (hf >= 2) return "text-emerald-400";
  if (hf >= 1.5) return "text-yellow-400";
  if (hf >= 1.2) return "text-orange-400";
  return "text-red-400";
}

function MbCard({ children, coords = "X:0 Y:0", className = "" }: { children: React.ReactNode; coords?: string; className?: string }) {
  return (
    <div className={`rounded-sm border border-white/[0.18] bg-[#0d0f13] ${className}`}>
      <div className="flex items-center justify-between border-b border-white/[0.18] px-3 py-2">
        <div className="flex items-center gap-2 text-zinc-600">
          <Minus className="h-3 w-3" />
          <Move className="h-3 w-3" />
        </div>
        <span className="font-mono text-[10px] tracking-widest text-zinc-600">{coords}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function VaultPage() {
  const txUrl = (hash: string) => `${EXPLORER_BASE}/tx/${hash}`;

  const {
    loading, wallet, position, riskState, oracleStale, lastTxHash,
    depositCollateral, withdrawCollateral, mintPusd, burnPusd,
    liquidatePosition, getVaultStateFor,
  } = useProtocol();

  const [depositAmount, setDepositAmount] = useState("1");
  const [mintAmount, setMintAmount] = useState("1");
  const [burnAmount, setBurnAmount] = useState("0.5");
  const [withdrawAmount, setWithdrawAmount] = useState("0.1");
  const [targetAddress, setTargetAddress] = useState("");
  const [targetState, setTargetState] = useState<{ collateral: string; debt: string; healthFactor: string } | null>(null);
  const [mintConfirmed, setMintConfirmed] = useState(false);

  const price = Number(position.dotPrice || "0");
  const collateral = Number(position.collateral || "0");
  const debt = Number(position.debt || "0");
  const hf = Number(position.healthFactor === "Infinity" ? "999" : position.healthFactor || "0");
  const ratio = riskState.ratioBps / 10000;

  const maxMintable = useMemo(() => {
    if (!price || !collateral || !ratio) return 0;
    return Math.max(0, (collateral * price) / ratio - debt);
  }, [collateral, debt, price, ratio]);

  const liquidationPrice = useMemo(() => {
    if (!collateral || !debt) return 0;
    return (debt * 1.2) / collateral;
  }, [collateral, debt]);

  const maxSafeWithdraw = useMemo(() => {
    if (!debt || !price) return collateral;
    return Math.max(0, collateral - (debt * ratio) / price);
  }, [collateral, debt, price, ratio]);

  const mintPreview = useMemo(() => {
    const nextDebt = debt + Number(mintAmount || "0");
    if (!nextDebt || !price) return { health: 999, requiredUsd: 0, nextDebt };
    return { health: (collateral * price) / nextDebt, requiredUsd: nextDebt * ratio, nextDebt };
  }, [collateral, debt, mintAmount, price, ratio]);

  const withdrawPreview = useMemo(() => {
    const nextCollateral = Math.max(0, collateral - Number(withdrawAmount || "0"));
    if (!debt || !price) return { nextCollateral, health: 999 };
    return { nextCollateral, health: (nextCollateral * price) / debt };
  }, [collateral, debt, price, withdrawAmount]);

  async function onCheckTarget(e: FormEvent) {
    e.preventDefault();
    const state = await getVaultStateFor(targetAddress);
    setTargetState(state);
  }

  async function handleMint() {
    setMintConfirmed(false);
    await mintPusd(mintAmount);
    setMintConfirmed(true);
  }

  const targetHf = Number(targetState?.healthFactor || "999");
  const targetLiquidatable = targetState ? targetHf < 1.2 : false;

  return (
    <section className="space-y-5">
      <div>
        <h1 className="font-pixel text-5xl sm:text-6xl lg:text-7xl tracking-tight text-white">VAULT</h1>
        <p className="mt-1 text-sm text-zinc-500">Manage collateral, mint pUSD, and monitor position health.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Position card */}
        <MbCard coords="X:0 Y:0">
          <p className="mb-3 text-xs font-mono uppercase tracking-widest text-zinc-200">User Position</p>
          <p className="mb-4 text-[11px] text-zinc-600">Current collateralized pUSD status</p>

          {!wallet ? (
            <p className="font-mono text-sm text-zinc-500">No active wallet. Connect wallet to load your position.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Metric label="Collateral Deposited" value={`${collateral.toFixed(2)} DOT`} tint="text-white" />
                <Metric label="Debt Outstanding" value={`${debt.toFixed(2)} pUSD`} tint="text-white" />
                <Metric label="Health Factor" value={position.healthFactor} tint={healthClass(hf)} />
                <Metric label="Max Additional Mintable" value={`${maxMintable.toFixed(2)} pUSD`} tint="text-white" />
              </div>

              <div className="mt-4 space-y-2">
                <p className="text-xs font-mono uppercase tracking-widest text-zinc-500">Health Bar</p>
                <div className="h-1.5 overflow-hidden rounded-sm bg-black/60 border border-white/[0.08]">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-yellow-400 to-red-500"
                    style={{ width: `${Math.min(100, Math.max(8, hf * 35))}%` }}
                  />
                </div>
              </div>

              <p className="mt-4 font-mono text-sm text-zinc-400">
                Liquidation Price: <span className="text-zinc-200">${liquidationPrice.toFixed(3)}</span>
              </p>
            </>
          )}
        </MbCard>

        {/* Actions card */}
        <MbCard coords="X:1 Y:0">
          <p className="mb-3 text-xs font-mono uppercase tracking-widest text-zinc-200">Actions</p>
          <p className="mb-4 text-[11px] text-zinc-600">Deposit/mint, burn/withdraw, and liquidation workflows</p>

          <Tabs defaultValue="mint" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3 rounded-sm border border-white/[0.18] bg-black p-0.5">
              <TabsTrigger value="mint" className="rounded-sm font-mono text-xs data-[state=active]:bg-[#0d0f13] data-[state=active]:text-zinc-100">
                Deposit & Mint
              </TabsTrigger>
              <TabsTrigger value="burn" className="rounded-sm font-mono text-xs data-[state=active]:bg-[#0d0f13] data-[state=active]:text-zinc-100">
                Burn & Withdraw
              </TabsTrigger>
              <TabsTrigger value="liquidate" className="rounded-sm font-mono text-xs data-[state=active]:bg-[#0d0f13] data-[state=active]:text-zinc-100">
                Liquidate
              </TabsTrigger>
            </TabsList>

            <TabsContent value="mint" className="space-y-3">
              <ActionBox label="Deposit DOT">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <Input value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="DOT amount" className="rounded-sm border-white/40 bg-zinc-900 font-mono text-xs text-white placeholder:text-zinc-600" />
                  <IconBtn disabled={loading || !wallet} onClick={() => void depositCollateral(depositAmount)}><Check /></IconBtn>
                </div>
              </ActionBox>

              <ActionBox label={`Mint pUSD — ratio ${(riskState.ratioBps / 100).toFixed(0)}%`}>
                {oracleStale && (
                  <div className="mb-2 flex items-center gap-2 rounded-sm border border-yellow-500/30 bg-yellow-500/10 p-2 text-xs font-mono text-yellow-400">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Price oracle is stale (&gt;30 min). Mint will revert until refreshed.
                  </div>
                )}
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <Input value={mintAmount} onChange={(e) => setMintAmount(e.target.value)} placeholder="pUSD amount" className="rounded-sm border-white/40 bg-zinc-900 font-mono text-xs text-white placeholder:text-zinc-600" />
                  <IconBtn disabled={loading || !wallet || mintPreview.health < 1.2 || oracleStale} onClick={() => void handleMint()}><Check /></IconBtn>
                </div>
                <p className="mt-2 font-mono text-[11px] text-zinc-600">
                  New debt: {mintPreview.nextDebt.toFixed(2)} pUSD · Health: {mintPreview.health.toFixed(3)} · Required: ${mintPreview.requiredUsd.toFixed(2)}
                </p>
                {mintPreview.health < 1.3 && mintPreview.health >= 1.2 && (
                  <p className="mt-1 font-mono text-[11px] text-yellow-400">Position will be close to liquidation.</p>
                )}
                {mintPreview.health < 1.2 && (
                  <p className="mt-1 font-mono text-[11px] text-red-400">Exceeds borrowing limit.</p>
                )}
              </ActionBox>
            </TabsContent>

            <TabsContent value="burn" className="space-y-3">
              <ActionBox label="Burn pUSD">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <Input value={burnAmount} onChange={(e) => setBurnAmount(e.target.value)} placeholder="pUSD amount" className="rounded-sm border-white/40 bg-zinc-900 font-mono text-xs text-white placeholder:text-zinc-600" />
                  <IconBtn onClick={() => setBurnAmount(position.pusdBalance)}><Plus /></IconBtn>
                  <IconBtn disabled={loading || !wallet} onClick={() => void burnPusd(burnAmount)}><Check /></IconBtn>
                </div>
              </ActionBox>

              <ActionBox label="Withdraw DOT">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <Input value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="DOT amount" className="rounded-sm border-white/40 bg-zinc-900 font-mono text-xs text-white placeholder:text-zinc-600" />
                  <IconBtn onClick={() => setWithdrawAmount(maxSafeWithdraw.toFixed(4))}><Plus /></IconBtn>
                  <IconBtn disabled={loading || !wallet} onClick={() => void withdrawCollateral(withdrawAmount)}><Check /></IconBtn>
                </div>
                <p className="mt-2 font-mono text-[11px] text-zinc-600">
                  Remaining: {withdrawPreview.nextCollateral.toFixed(4)} DOT · Health: {withdrawPreview.health.toFixed(3)}
                </p>
              </ActionBox>
            </TabsContent>

            <TabsContent value="liquidate" className="space-y-3">
              <form onSubmit={onCheckTarget}>
                <ActionBox label="Check Address">
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <Input value={targetAddress} onChange={(e) => setTargetAddress(e.target.value)} placeholder="0x..." className="rounded-sm border-white/40 bg-zinc-900 font-mono text-xs text-white placeholder:text-zinc-600" />
                    <MbButton type="submit" variant="outline">Check Health</MbButton>
                  </div>
                </ActionBox>
              </form>

              {targetState && (
                <div className="rounded-sm border border-white/[0.18] bg-black/30 p-3 font-mono text-sm">
                  <p className="text-zinc-400">Collateral: <span className="text-zinc-200">{targetState.collateral} DOT</span></p>
                  <p className="text-zinc-400">Debt: <span className="text-zinc-200">{targetState.debt} pUSD</span></p>
                  <p className="text-zinc-400">Health Factor: <span className={cn("text-zinc-200", healthClass(targetHf))}>{targetState.healthFactor}</span></p>
                  {targetLiquidatable ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-red-400">This position is liquidatable.</p>
                      <MbButton disabled={loading} onClick={() => void liquidatePosition(targetAddress)}>Liquidate</MbButton>
                    </div>
                  ) : (
                    <p className="mt-3 text-emerald-400">This position is healthy.</p>
                  )}
                </div>
              )}

              <p className="font-mono text-[11px] text-zinc-600">Liquidators repay borrower debt in pUSD and receive DOT collateral at a discount.</p>
            </TabsContent>
          </Tabs>
        </MbCard>
      </div>

      {/* Mint flow card */}
      {mintConfirmed && lastTxHash && (
        <MbCard coords="X:0 Y:1">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-sm border border-purple-500/30 bg-black px-2 py-0.5 font-mono text-[10px] tracking-widest text-purple-400">CROSS-VM</span>
            <p className="font-mono text-xs uppercase tracking-widest text-zinc-200">Mint Transaction Flow</p>
          </div>
          <p className="mb-3 text-[11px] text-zinc-600">What happened inside your last mint transaction</p>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <FlowBadge color="pink">CollateralVault.sol</FlowBadge>
            <ArrowRight className="h-3.5 w-3.5 text-zinc-600" />
            <FlowBadge color="purple">RiskEngine (Rust / PolkaVM)</FlowBadge>
            <ArrowRight className="h-3.5 w-3.5 text-zinc-600" />
            <FlowBadge color="zinc">regime: {riskState.regime}, ratio: {(riskState.ratioBps / 100).toFixed(0)}%</FlowBadge>
            <ArrowRight className="h-3.5 w-3.5 text-zinc-600" />
            <FlowBadge color="emerald">pUSD minted</FlowBadge>
          </div>

          <p className="mt-3 break-all font-mono text-[11px] text-zinc-600">
            Tx:{" "}
            <a href={txUrl(lastTxHash)} target="_blank" rel="noreferrer" className="text-purple-400 underline underline-offset-2 hover:text-purple-300">
              {lastTxHash}
            </a>
          </p>
          <p className="mt-2 font-mono text-[11px] text-zinc-600">
            The vault called the Rust contract synchronously — risk assessment and mint happened atomically in one transaction on Polkadot Hub.
          </p>
        </MbCard>
      )}
    </section>
  );
}

function Metric({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <div className="rounded-sm border border-white/[0.18] bg-black/30 p-3">
      <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">{label}</p>
      <p className={`mt-1 font-pixel text-xl tabular-nums ${tint || "text-white"}`}>{value}</p>
    </div>
  );
}

function ActionBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-white/[0.18] bg-black/20 p-3">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-zinc-200">{label}</p>
      {children}
    </div>
  );
}

function MbButton({ children, className = "", variant = "default", ...props }: React.ComponentProps<typeof Button> & { variant?: "default" | "outline" }) {
  return (
    <Button
      {...props}
      className={cn(
        "rounded-sm font-mono text-xs tracking-wide",
        variant === "outline"
          ? "border border-white/40 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:border-white/60"
          : "border border-white/40 bg-zinc-900 text-white hover:bg-zinc-800 hover:border-white/60",
        className
      )}
    />
  );
}

function IconBtn({ children, disabled, onClick, type }: { children: React.ReactNode; disabled?: boolean; onClick?: () => void; type?: "button" | "submit" }) {
  return (
    <button
      type={type || "button"}
      disabled={disabled}
      onClick={onClick}
      style={{ color: '#ffffff', background: '#18181b', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '2px', padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1 }}
    >
      {children}
    </button>
  );
}

function FlowBadge({ children, color }: { children: React.ReactNode; color: "pink" | "purple" | "zinc" | "emerald" }) {
  const styles = {
    pink: "border-pink-500/30 bg-black text-pink-400",
    purple: "border-purple-500/30 bg-black text-purple-400",
    zinc: "border-white/[0.18] bg-black text-zinc-400",
    emerald: "border-emerald-500/30 bg-black text-emerald-400",
  };
  return (
    <span className={`rounded-sm border px-2 py-0.5 font-mono text-xs ${styles[color]}`}>{children}</span>
  );
}
