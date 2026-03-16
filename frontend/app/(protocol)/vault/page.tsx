"use client";

import { FormEvent, useMemo, useState } from "react";
import { useProtocol } from "@/components/protocol/protocol-provider";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function healthClass(hf: number) {
  if (hf >= 2) return "text-emerald-300";
  if (hf >= 1.5) return "text-yellow-300";
  if (hf >= 1.2) return "text-orange-300";
  return "text-red-300";
}

export default function VaultPage() {
  const {
    loading,
    wallet,
    position,
    riskState,
    oracleStale,
    lastTxHash,
    depositCollateral,
    withdrawCollateral,
    mintPusd,
    burnPusd,
    liquidatePosition,
    getVaultStateFor,
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
    const collateralUsd = collateral * price;
    const maxDebt = collateralUsd / ratio;
    return Math.max(0, maxDebt - debt);
  }, [collateral, debt, price, ratio]);

  const liquidationPrice = useMemo(() => {
    if (!collateral || !debt) return 0;
    return (debt * 1.2) / collateral;
  }, [collateral, debt]);

  const maxSafeWithdraw = useMemo(() => {
    if (!debt || !price) return collateral;
    const requiredUsd = debt * ratio;
    const requiredCollateral = requiredUsd / price;
    return Math.max(0, collateral - requiredCollateral);
  }, [collateral, debt, price, ratio]);

  const mintPreview = useMemo(() => {
    const nextDebt = debt + Number(mintAmount || "0");
    if (!nextDebt || !price) {
      return { health: 999, requiredUsd: 0, nextDebt };
    }
    const collateralUsd = collateral * price;
    const health = collateralUsd / nextDebt;
    return { health, requiredUsd: nextDebt * ratio, nextDebt };
  }, [collateral, debt, mintAmount, price, ratio]);

  const withdrawPreview = useMemo(() => {
    const nextCollateral = Math.max(0, collateral - Number(withdrawAmount || "0"));
    if (!debt || !price) {
      return { nextCollateral, health: 999 };
    }
    const collateralUsd = nextCollateral * price;
    return {
      nextCollateral,
      health: collateralUsd / debt,
    };
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
    <section className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
      <Card className="border-white/10 bg-[#141925]">
        <CardHeader>
          <CardTitle className="text-zinc-100">User Position</CardTitle>
          <CardDescription>Current collateralized pUSD status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!wallet ? (
            <p className="text-sm text-zinc-400">No active wallet. Connect wallet to load your position.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Metric label="Collateral Deposited" value={`${collateral.toFixed(2)} DOT`} tint="text-pink-300" />
                <Metric label="Debt Outstanding" value={`${debt.toFixed(2)} pUSD`} tint="text-emerald-200" />
                <Metric label="Health Factor" value={position.healthFactor} tint={healthClass(hf)} />
                <Metric label="Max Additional Mintable" value={`${maxMintable.toFixed(2)} pUSD`} tint="text-emerald-200" />
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Health Bar</p>
                <div className="h-2 overflow-hidden rounded bg-black/40">
                  <div
                    className="h-2 bg-gradient-to-r from-emerald-500 via-yellow-400 to-red-500"
                    style={{ width: `${Math.min(100, Math.max(8, hf * 35))}%` }}
                  />
                </div>
              </div>

              <p className="text-sm text-zinc-300">Liquidation Price: <span className="font-mono">${liquidationPrice.toFixed(3)}</span></p>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#141925]">
        <CardHeader>
          <CardTitle className="text-zinc-100">Actions</CardTitle>
          <CardDescription>Deposit/mint, burn/withdraw, and liquidation workflows</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="mint" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3 bg-black/40">
              <TabsTrigger value="mint">Deposit & Mint</TabsTrigger>
              <TabsTrigger value="burn">Burn & Withdraw</TabsTrigger>
              <TabsTrigger value="liquidate">Liquidate</TabsTrigger>
            </TabsList>

            <TabsContent value="mint" className="space-y-4">
              <div className="rounded-md border border-white/10 bg-black/20 p-3">
                <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Deposit DOT</p>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <Input value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="DOT amount" />
                  <Button disabled={loading || !wallet} onClick={() => void depositCollateral(depositAmount)}>Deposit</Button>
                </div>
              </div>

              <div className="rounded-md border border-white/10 bg-black/20 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Mint pUSD</p>
                  <Badge variant="outline" className="border-purple-400/30 text-purple-200">Current ratio {(riskState.ratioBps / 100).toFixed(0)}%</Badge>
                </div>
                {oracleStale && (
                  <div className="mb-2 flex items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-2 text-xs text-yellow-300">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Price oracle is stale (&gt;30 min). Mint will revert until the oracle daemon refreshes the price.
                  </div>
                )}
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <Input value={mintAmount} onChange={(e) => setMintAmount(e.target.value)} placeholder="pUSD amount" />
                  <Button
                    disabled={loading || !wallet || mintPreview.health < 1.2 || oracleStale}
                    onClick={() => void handleMint()}
                  >
                    Mint pUSD
                  </Button>
                </div>
                <p className="mt-2 text-xs text-zinc-400">New debt: {mintPreview.nextDebt.toFixed(2)} pUSD | New health factor: {mintPreview.health.toFixed(3)} | Required collateral: ${mintPreview.requiredUsd.toFixed(2)}</p>
                {mintPreview.health < 1.3 && mintPreview.health >= 1.2 ? (
                  <p className="mt-2 text-xs text-yellow-300">Position will be close to liquidation.</p>
                ) : null}
                {mintPreview.health < 1.2 ? (
                  <p className="mt-2 text-xs text-red-300">Exceeds borrowing limit.</p>
                ) : null}
              </div>
            </TabsContent>

            <TabsContent value="burn" className="space-y-4">
              <div className="rounded-md border border-white/10 bg-black/20 p-3">
                <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Burn pUSD</p>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <Input value={burnAmount} onChange={(e) => setBurnAmount(e.target.value)} placeholder="pUSD amount" />
                  <Button variant="outline" onClick={() => setBurnAmount(position.pusdBalance)}>Max</Button>
                  <Button disabled={loading || !wallet} onClick={() => void burnPusd(burnAmount)}>Burn</Button>
                </div>
              </div>

              <div className="rounded-md border border-white/10 bg-black/20 p-3">
                <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Withdraw DOT</p>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <Input value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="DOT amount" />
                  <Button variant="outline" onClick={() => setWithdrawAmount(maxSafeWithdraw.toFixed(4))}>Max Safe</Button>
                  <Button disabled={loading || !wallet} onClick={() => void withdrawCollateral(withdrawAmount)}>Withdraw</Button>
                </div>
                <p className="mt-2 text-xs text-zinc-400">Remaining collateral: {withdrawPreview.nextCollateral.toFixed(4)} DOT | New health factor: {withdrawPreview.health.toFixed(3)}</p>
              </div>
            </TabsContent>

            <TabsContent value="liquidate" className="space-y-4">
              <form onSubmit={onCheckTarget} className="rounded-md border border-white/10 bg-black/20 p-3">
                <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Check Address</p>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <Input value={targetAddress} onChange={(e) => setTargetAddress(e.target.value)} placeholder="0x..." />
                  <Button type="submit" variant="outline">Check Health</Button>
                </div>
              </form>

              {targetState ? (
                <div className="rounded-md border border-white/10 bg-black/20 p-3 text-sm text-zinc-300">
                  <p>Collateral: {targetState.collateral} DOT</p>
                  <p>Debt: {targetState.debt} pUSD</p>
                  <p>Health Factor: {targetState.healthFactor}</p>
                  {targetLiquidatable ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-red-300">This position is liquidatable.</p>
                      <Button disabled={loading} onClick={() => void liquidatePosition(targetAddress)}>
                        Liquidate
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-3 text-emerald-300">This position is healthy.</p>
                  )}
                </div>
              ) : null}

              <p className="text-xs text-zinc-500">Liquidators repay borrower debt in pUSD and receive DOT collateral at a discount.</p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      </div>

      {mintConfirmed && lastTxHash && (
        <Card className="border-purple-500/20 bg-[#141925]">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-300">Cross-VM</span>
              <CardTitle className="text-sm text-zinc-200">Mint Transaction Flow</CardTitle>
            </div>
            <CardDescription>What happened inside your last mint transaction</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded border border-pink-500/30 bg-pink-500/10 px-2 py-0.5 font-mono text-xs text-pink-300">CollateralVault.sol</span>
              <ArrowRight className="h-3.5 w-3.5 text-zinc-500" />
              <span className="rounded border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 font-mono text-xs text-purple-300">RiskEngine (Rust / PolkaVM)</span>
              <ArrowRight className="h-3.5 w-3.5 text-zinc-500" />
              <span className="rounded border border-zinc-500/30 bg-zinc-500/10 px-2 py-0.5 font-mono text-xs text-zinc-300">regime: {riskState.regime}, ratio: {(riskState.ratioBps / 100).toFixed(0)}%</span>
              <ArrowRight className="h-3.5 w-3.5 text-zinc-500" />
              <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-xs text-emerald-300">pUSD minted</span>
            </div>
            <p className="break-all text-xs text-zinc-500">Tx: {lastTxHash}</p>
            <p className="text-xs text-zinc-600">The vault called the Rust contract synchronously — risk assessment and mint happened atomically in one transaction on Polkadot Hub.</p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function Metric({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-3">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-1 font-mono text-sm tabular-nums ${tint || "text-zinc-100"}`}>{value}</p>
    </div>
  );
}
