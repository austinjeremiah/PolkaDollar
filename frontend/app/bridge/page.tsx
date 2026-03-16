"use client";

import { FormEvent, useMemo, useState } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { usePolkadollarBackend } from "@/hooks/use-polkadollar-backend";

const DEFAULT_XCM_MESSAGE =
  process.env.NEXT_PUBLIC_XCM_MESSAGE ||
  "0x040c000400000002093d0001000000821a0600010b0200000103000000000000000000000000000000000000000000000000000000000000000000";

function shortAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function BridgePage() {
  const {
    loading,
    error,
    clearError,
    connectWallet,
    switchNetwork,
    depositCollateral,
    withdrawCollateral,
    mintPusd,
    burnPusd,
    getVaultState,
    getPusdBalance,
    getCurrentPrice,
    sendXcmToHydration,
    addresses,
    xcmDestHydration,
  } = usePolkadollarBackend();

  const [wallet, setWallet] = useState("");
  const [status, setStatus] = useState("Idle");
  const [lastTxHash, setLastTxHash] = useState("");

  const [depositAmount, setDepositAmount] = useState("1");
  const [withdrawAmount, setWithdrawAmount] = useState("0.1");
  const [mintAmount, setMintAmount] = useState("1");
  const [burnAmount, setBurnAmount] = useState("0.5");
  const [xcmMessage, setXcmMessage] = useState(DEFAULT_XCM_MESSAGE);

  const [collateral, setCollateral] = useState("0");
  const [debt, setDebt] = useState("0");
  const [healthFactor, setHealthFactor] = useState("-");
  const [pusdBalance, setPusdBalance] = useState("0");
  const [dotPrice, setDotPrice] = useState("0");

  const walletLabel = useMemo(() => (wallet ? shortAddress(wallet) : "Connect MetaMask"), [wallet]);

  async function onConnectWallet() {
    clearError();
    try {
      const addr = await connectWallet();
      setWallet(addr);
      setStatus(`Connected ${shortAddress(addr)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Wallet connection failed";
      setStatus(message);
    }
  }

  async function onRefresh(address = wallet) {
    if (!address) return;
    clearError();
    setStatus("Refreshing on-chain state...");

    try {
      const [vaultState, balance, price] = await Promise.all([
        getVaultState(address),
        getPusdBalance(address),
        getCurrentPrice(),
      ]);

      setCollateral(vaultState.collateral);
      setDebt(vaultState.debt);
      setHealthFactor(vaultState.healthFactor);
      setPusdBalance(balance);
      setDotPrice(price);
      setStatus("State refreshed");
    } catch {
      setStatus("Refresh failed");
    }
  }

  async function runAction(label: string, action: () => Promise<{ hash: string }>) {
    clearError();
    setStatus(`${label} in progress...`);
    try {
      const result = await action();
      setLastTxHash(result.hash);
      setStatus(`${label} confirmed`);
      await onRefresh();
    } catch {
      setStatus(`${label} failed`);
    }
  }

  async function onSubmitDeposit(e: FormEvent) {
    e.preventDefault();
    await runAction("Deposit", () => depositCollateral(depositAmount));
  }

  async function onSubmitWithdraw(e: FormEvent) {
    e.preventDefault();
    await runAction("Withdraw", () => withdrawCollateral(withdrawAmount));
  }

  async function onSubmitMint(e: FormEvent) {
    e.preventDefault();
    await runAction("Mint", () => mintPusd(mintAmount));
  }

  async function onSubmitBurn(e: FormEvent) {
    e.preventDefault();
    await runAction("Burn", () => burnPusd(burnAmount));
  }

  async function onSendXcm(e: FormEvent) {
    e.preventDefault();
    await runAction("XCM send", () => sendXcmToHydration(xcmMessage));
  }

  return (
    <div className="min-h-screen dot-grid-bg">
      <Navbar />

      <main className="px-4 pb-16 pt-8 lg:px-8">
        <section className="mx-auto w-full max-w-6xl space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-pixel tracking-tight text-foreground lg:text-5xl">POLKA$ CONTROL PANEL</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              End-to-end backend wiring: connect wallet, manage collateralized pUSD position, read oracle price, and
              send XCM messages to Hydration.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Wallet + Network</CardTitle>
              <CardDescription>Connect MetaMask and switch to Paseo Asset Hub before using vault actions.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <Button onClick={onConnectWallet} variant="outline" disabled={loading}>
                {walletLabel}
              </Button>
              <Button onClick={() => switchNetwork()} variant="outline" disabled={loading}>
                Switch to Paseo
              </Button>
              <Button onClick={() => onRefresh()} disabled={loading || !wallet}>
                Refresh State
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Live Position</CardTitle>
                <CardDescription>State read directly from CollateralVault, PolkaDollar, and PriceFeed.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>Wallet: {wallet || "-"}</p>
                <p>DOT Price: ${dotPrice}</p>
                <p>Collateral: {collateral} DOT</p>
                <p>Debt: {debt} pUSD</p>
                <p>pUSD Balance: {pusdBalance}</p>
                <p>Health Factor: {healthFactor}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Status</CardTitle>
                <CardDescription>Transaction and integration state.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>{status}</p>
                {error ? (
                  <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
                    {error}
                  </div>
                ) : null}
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Last Tx Hash</p>
                  <p className="break-all rounded-md border bg-muted/30 p-3 text-xs font-mono">{lastTxHash || "-"}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Vault Actions</CardTitle>
                <CardDescription>Deposit/withdraw DOT and mint/burn pUSD using deployed contracts.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form className="grid gap-2 sm:grid-cols-[1fr_auto]" onSubmit={onSubmitDeposit}>
                  <Input value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="DOT amount" />
                  <Button type="submit" disabled={loading || !wallet}>Deposit DOT</Button>
                </form>

                <form className="grid gap-2 sm:grid-cols-[1fr_auto]" onSubmit={onSubmitWithdraw}>
                  <Input value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="DOT amount" />
                  <Button type="submit" disabled={loading || !wallet} variant="outline">Withdraw DOT</Button>
                </form>

                <form className="grid gap-2 sm:grid-cols-[1fr_auto]" onSubmit={onSubmitMint}>
                  <Input value={mintAmount} onChange={(e) => setMintAmount(e.target.value)} placeholder="pUSD amount" />
                  <Button type="submit" disabled={loading || !wallet}>Mint pUSD</Button>
                </form>

                <form className="grid gap-2 sm:grid-cols-[1fr_auto]" onSubmit={onSubmitBurn}>
                  <Input value={burnAmount} onChange={(e) => setBurnAmount(e.target.value)} placeholder="pUSD amount" />
                  <Button type="submit" disabled={loading || !wallet} variant="outline">Burn pUSD</Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">XCM Send to Hydration</CardTitle>
                <CardDescription>Direct precompile route using configured destination and message bytes.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">Precompile: {addresses.xcmPrecompile}</p>
                <p className="text-xs text-muted-foreground">Destination: {xcmDestHydration}</p>
                <form className="space-y-2" onSubmit={onSendXcm}>
                  <Input
                    value={xcmMessage}
                    onChange={(e) => setXcmMessage(e.target.value)}
                    placeholder="0x..."
                  />
                  <Button className="w-full" type="submit" disabled={loading || !wallet}>
                    Send XCM Message
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
