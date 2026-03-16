"use client";

import { FormEvent, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { useProtocol } from "@/components/protocol/protocol-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DEFAULT_XCM_MESSAGE =
  process.env.NEXT_PUBLIC_XCM_MESSAGE ||
  "0x040c000400000002093d0001000000821a06000b0200000103000000000000000000000000000000000000000000000000000000000000000000";

const DESTINATIONS = [
  { id: "hydration", label: "Hydration", paraId: "2034" },
  { id: "moonbeam", label: "Moonbeam", paraId: "2004" },
];

export default function BridgePage() {
  const {
    wallet,
    loading,
    bridgeStatus,
    position,
    sendCrossChain,
    lastTxHash,
    xcmDestination,
    xcmPrecompile,
  } = useProtocol();

  const [destination, setDestination] = useState("hydration");
  const [amount, setAmount] = useState("1");
  const [recipient, setRecipient] = useState(wallet);
  const [xcmMessage, setXcmMessage] = useState(DEFAULT_XCM_MESSAGE);

  const selectedDestination = useMemo(
    () => DESTINATIONS.find((d) => d.id === destination) || DESTINATIONS[0],
    [destination]
  );

  function onSend(e: FormEvent) {
    e.preventDefault();
    void sendCrossChain(xcmMessage);
  }

  const steps = [
    { key: "encoding", label: "Encoding XCM" },
    { key: "submitting", label: "Submitting" },
    { key: "confirming", label: "Confirming on Hub" },
    { key: "delivered", label: "Delivered" },
  ] as const;

  return (
    <section className="mx-auto w-full max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Bridge</h1>
        <p className="text-sm text-zinc-400">Send pUSD cross-chain through the XCM precompile flow.</p>
      </div>

      <Card className="border-white/10 bg-[#141925]">
        <CardHeader>
          <CardTitle className="text-zinc-100">Cross-Chain Transfer</CardTitle>
          <CardDescription>From Polkadot Hub to a selected parachain destination</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSend} className="space-y-4">
            <section className="space-y-2 rounded-md border border-white/10 bg-black/20 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Step 1: Source</p>
              <p className="text-sm text-zinc-200">From: Polkadot Hub</p>
              <p className="text-sm text-zinc-200">pUSD Balance: <span className="font-mono text-emerald-200">{Number(position.pusdBalance || "0").toFixed(2)}</span></p>
            </section>

            <section className="space-y-2 rounded-md border border-white/10 bg-black/20 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Step 2: Destination</p>
              <Select value={destination} onValueChange={setDestination}>
                <SelectTrigger>
                  <SelectValue placeholder="Select destination" />
                </SelectTrigger>
                <SelectContent>
                  {DESTINATIONS.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label} (ParaID {item.paraId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-zinc-500">Configured XCM destination bytes: {xcmDestination}</p>
            </section>

            <section className="space-y-2 rounded-md border border-white/10 bg-black/20 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Step 3: Amount</p>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="pUSD amount" />
                <Button type="button" variant="outline" onClick={() => setAmount(position.pusdBalance)}>Max</Button>
              </div>
            </section>

            <section className="space-y-2 rounded-md border border-white/10 bg-black/20 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Step 4: Recipient</p>
              <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Destination address" />
              <p className="text-xs text-zinc-500">Default recipient is your connected address on destination chain.</p>
            </section>

            <section className="space-y-2 rounded-md border border-white/10 bg-black/20 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Step 5: Review</p>
              <p className="text-sm text-zinc-200">Send {Number(amount || "0").toFixed(2)} pUSD from Polkadot Hub to {selectedDestination.label}</p>
              <p className="text-xs text-zinc-500">Estimated delivery: around 30 seconds (testnet)</p>

              <Input value={xcmMessage} onChange={(e) => setXcmMessage(e.target.value)} placeholder="XCM message bytes" />

              <Button className="w-full bg-purple-600 hover:bg-purple-500" type="submit" disabled={loading || !wallet}>
                Send Cross-Chain
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </section>
          </form>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#141925]">
        <CardHeader>
          <CardTitle className="text-zinc-100">Transaction Status</CardTitle>
          <CardDescription>End-to-end XCM flow progress</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {steps.map((step, index) => {
            const reached = ["encoding", "submitting", "confirming", "submitted", "delivered"].includes(bridgeStatus) &&
              ["encoding", "submitting", "confirming", "delivered"].indexOf(step.key) <= ["encoding", "submitting", "confirming", "delivered"].indexOf(bridgeStatus === "submitted" ? "confirming" : bridgeStatus === "failed" ? "encoding" : bridgeStatus);
            const current = bridgeStatus === step.key;

            return (
              <div key={step.key} className="flex items-center gap-3 text-sm">
                {current ? <Loader2 className="h-4 w-4 animate-spin text-purple-300" /> : reached ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <div className="h-4 w-4 rounded-full border border-zinc-600" />}
                <p className={reached ? "text-zinc-100" : "text-zinc-500"}>{index + 1}. {step.label}</p>
              </div>
            );
          })}

          {bridgeStatus === "delivered" ? (
            <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2 text-sm text-emerald-200">
              {Number(amount || "0").toFixed(2)} pUSD delivered to {selectedDestination.label} (testnet flow).
            </p>
          ) : null}

          {lastTxHash ? (
            <p className="break-all rounded-md border border-white/10 bg-black/20 p-2 text-xs text-zinc-400">Last tx: {lastTxHash}</p>
          ) : null}
        </CardContent>
      </Card>

      {(bridgeStatus === "submitted" || bridgeStatus === "delivered") && (
        <Card className="border-purple-500/20 bg-[#141925]">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300">Polkadot Native</span>
              <CardTitle className="text-zinc-100">XCM Precompile Details</CardTitle>
            </div>
            <CardDescription>How your cross-chain message was routed</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-zinc-300">
            <div className="rounded-md border border-white/10 bg-black/20 p-3">
              <p className="mb-1 text-xs uppercase tracking-wide text-zinc-500">Precompile Address</p>
              <p className="font-mono break-all text-zinc-200">{xcmPrecompile}</p>
            </div>
            <div className="rounded-md border border-white/10 bg-black/20 p-3">
              <p className="mb-1 text-xs uppercase tracking-wide text-zinc-500">Destination bytes</p>
              <p className="font-mono break-all text-zinc-400">{xcmDestination}</p>
              <p className="mt-1 text-xs text-zinc-500">SCALE-encoded MultiLocation for the destination parachain</p>
            </div>
            <p className="text-xs text-zinc-500">
              The XCM precompile is a Polkadot-native feature exposed at a fixed address. Any Solidity contract on Polkadot Hub can send cross-chain messages without a bridge relayer — this is not available on Ethereum or any other EVM chain.
            </p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
