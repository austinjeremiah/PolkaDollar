"use client";

import { FormEvent, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { useProtocol } from "@/components/protocol/protocol-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildXcmDestinationHex, buildXcmMessageHex, parseAccountId32 } from "@/lib/xcm";

const DEFAULT_EXECUTION_FEE_PLANCK = process.env.NEXT_PUBLIC_XCM_FEE_PLANCK || "100000";
const DEFAULT_AMOUNT_PLANCK = process.env.NEXT_PUBLIC_XCM_AMOUNT_PLANCK || "1000000";
const EXPLORER_BASE = (process.env.NEXT_PUBLIC_EXPLORER_URL || "https://blockscout-testnet.polkadot.io/").replace(/\/$/, "");

type DestinationOption = {
  id: string;
  label: string;
  kind: "relay" | "parachain" | "custom";
  paraId?: number;
  note: string;
};

const DESTINATIONS: DestinationOption[] = [
  {
    id: "relay",
    label: "Relay Chain",
    kind: "relay",
    note: "Parent chain destination (no paraId).",
  },
  {
    id: "hydration",
    label: "Hydration",
    kind: "parachain",
    paraId: Number(process.env.NEXT_PUBLIC_HYDRATION_PARA_ID || "2034"),
    note: "Hydration parachain destination.",
  },
  {
    id: "acala",
    label: "Acala",
    kind: "parachain",
    paraId: Number(process.env.NEXT_PUBLIC_ACALA_PARA_ID || "2000"),
    note: "Verify paraId for the current network before sending.",
  },
  {
    id: "moonbeam",
    label: "Moonbeam",
    kind: "parachain",
    paraId: Number(process.env.NEXT_PUBLIC_MOONBEAM_PARA_ID || "2004"),
    note: "Verify paraId for the current network before sending.",
  },
  {
    id: "astar",
    label: "Astar",
    kind: "parachain",
    paraId: Number(process.env.NEXT_PUBLIC_ASTAR_PARA_ID || "2006"),
    note: "Verify paraId for the current network before sending.",
  },
  {
    id: "bifrost",
    label: "Bifrost",
    kind: "parachain",
    paraId: Number(process.env.NEXT_PUBLIC_BIFROST_PARA_ID || "2030"),
    note: "Verify paraId for the current network before sending.",
  },
  {
    id: "interlay",
    label: "Interlay",
    kind: "parachain",
    paraId: Number(process.env.NEXT_PUBLIC_INTERLAY_PARA_ID || "2032"),
    note: "Verify paraId for the current network before sending.",
  },
  {
    id: "custom",
    label: "Custom ParaId",
    kind: "custom",
    note: "Use this when your target parachain is not listed.",
  },
];

export default function BridgePage() {
  const txUrl = (hash: string) => `${EXPLORER_BASE}/tx/${hash}`;

  const {
    wallet,
    loading,
    bridgeStatus,
    position,
    sendCrossChain,
    lastTxHash,
    xcmTxProof,
    xcmDestination,
    xcmPrecompile,
  } = useProtocol();

  const [destination, setDestination] = useState("relay");
  const [amountPlanck, setAmountPlanck] = useState(DEFAULT_AMOUNT_PLANCK);
  const [executionFeePlanck, setExecutionFeePlanck] = useState(DEFAULT_EXECUTION_FEE_PLANCK);
  const [recipient, setRecipient] = useState("");
  const [xcmMessagePreview, setXcmMessagePreview] = useState("");
  const [customParaId, setCustomParaId] = useState("");
  const [destinationBytesPreview, setDestinationBytesPreview] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const selectedDestination = useMemo(
    () => DESTINATIONS.find((d) => d.id === destination) || DESTINATIONS[0],
    [destination]
  );

  const destinationBytes = useMemo(() => {
    if (selectedDestination.kind === "relay") {
      return buildXcmDestinationHex({ type: "relay" });
    }

    if (selectedDestination.kind === "parachain" && selectedDestination.paraId !== undefined) {
      return buildXcmDestinationHex({
        type: "parachain",
        paraId: selectedDestination.paraId,
      });
    }

    if (selectedDestination.kind === "custom") {
      if (!/^\d+$/.test(customParaId)) return "";
      return buildXcmDestinationHex({
        type: "parachain",
        paraId: Number(customParaId),
      });
    }

    return xcmDestination;
  }, [customParaId, selectedDestination, xcmDestination]);

  const unsupportedDestination = !destinationBytes;

  async function onSend(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (unsupportedDestination) {
      setFormError("Destination bytes are not configured for this target.");
      return;
    }

    try {
      if (!/^\d+$/.test(amountPlanck)) {
        throw new Error("Amount must be an integer in planck units");
      }
      if (!/^\d+$/.test(executionFeePlanck)) {
        throw new Error("Execution fee must be an integer in planck units");
      }
      if (selectedDestination.kind === "custom" && !/^\d+$/.test(customParaId)) {
        throw new Error("Custom paraId must be an integer");
      }

      const beneficiary = await parseAccountId32(recipient);
      const messageHex = buildXcmMessageHex({
        beneficiaryAccountId32: beneficiary,
        amountPlanck: BigInt(amountPlanck),
        executionFeePlanck: BigInt(executionFeePlanck),
      });

      setDestinationBytesPreview(destinationBytes);
      setXcmMessagePreview(messageHex);
      await sendCrossChain(destinationBytes, messageHex);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to build XCM message";
      setFormError(msg);
    }
  }

  const steps = [
    { key: "encoding", label: "Encoding XCM" },
    { key: "submitting", label: "Submitting" },
    { key: "confirming", label: "Confirming on Hub" },
    { key: "submitted", label: "Submitted on Hub" },
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
                      {item.kind === "relay"
                        ? `${item.label} (Parent chain, no paraId)`
                        : item.kind === "custom"
                          ? `${item.label}`
                          : `${item.label} (ParaID ${item.paraId})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedDestination.kind === "custom" ? (
                <Input
                  value={customParaId}
                  onChange={(e) => setCustomParaId(e.target.value)}
                  placeholder="Enter parachain paraId (example: 2034)"
                />
              ) : null}

              <p className="text-xs text-zinc-500">Configured XCM destination bytes: {destinationBytes}</p>
              <p className="text-xs text-zinc-500">{selectedDestination.note}</p>
            </section>

            <section className="space-y-2 rounded-md border border-white/10 bg-black/20 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Step 3: Amount (Planck)</p>
              <Input
                value={amountPlanck}
                onChange={(e) => setAmountPlanck(e.target.value)}
                placeholder="Amount in planck"
              />
              <p className="text-xs text-zinc-500">Use integer planck units for the XCM asset amount.</p>
            </section>

            <section className="space-y-2 rounded-md border border-white/10 bg-black/20 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Step 4: Recipient</p>
              <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Hydration ss58 or 0x AccountId32" />
              <p className="text-xs text-zinc-500">Recipient must resolve to AccountId32 on destination chain.</p>
            </section>

            <section className="space-y-2 rounded-md border border-white/10 bg-black/20 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Step 5: Execution Fee (Planck)</p>
              <Input
                value={executionFeePlanck}
                onChange={(e) => setExecutionFeePlanck(e.target.value)}
                placeholder="Execution fee in planck"
              />
            </section>

            <section className="space-y-2 rounded-md border border-white/10 bg-black/20 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Step 6: Review</p>
              <p className="text-sm text-zinc-200">Send XCM payload from Polkadot Hub to {selectedDestination.label}</p>
              <p className="text-xs text-zinc-500">Estimated delivery: around 30 seconds (testnet)</p>

              <Input value={xcmMessagePreview} readOnly placeholder="XCM message preview appears after validation/send" />

              <Button className="w-full bg-purple-600 hover:bg-purple-500" type="submit" disabled={loading || !wallet || unsupportedDestination}>
                Send Cross-Chain
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              {unsupportedDestination ? (
                <p className="text-xs text-yellow-300">Set NEXT_PUBLIC_XCM_DEST_HYDRATION with valid destination bytes to enable this path.</p>
              ) : null}
              {formError ? <p className="text-xs text-red-300">{formError}</p> : null}
            </section>
          </form>
        </CardContent>
      </Card>

      <Card className="border-amber-500/20 bg-[#141925]">
        <CardHeader>
          <CardTitle className="text-zinc-100">Important: Asset Semantics</CardTitle>
          <CardDescription>Current flow dispatches XCM correctly, but destination crediting depends on chain support.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-zinc-400">
            This UI builds and submits XCM messages through the Hub precompile. Actual crediting on Hydration requires destination-side
            foreign asset support and routing for the asset location you are transferring.
          </p>
          <p className="mt-2 text-xs text-emerald-300">
            The precompile accepted our XCM message. On mainnet with registered assets, pUSD arrives cross-chain.
          </p>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#141925]">
        <CardHeader>
          <CardTitle className="text-zinc-100">Transaction Status</CardTitle>
          <CardDescription>End-to-end XCM flow progress</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {steps.map((step, index) => {
            const reached = ["encoding", "submitting", "confirming", "submitted"].includes(bridgeStatus) &&
              ["encoding", "submitting", "confirming", "submitted"].indexOf(step.key) <= ["encoding", "submitting", "confirming", "submitted"].indexOf(bridgeStatus === "failed" ? "encoding" : bridgeStatus);
            const current = bridgeStatus === step.key && bridgeStatus !== "submitted";

            return (
              <div key={step.key} className="flex items-center gap-3 text-sm">
                {current ? <Loader2 className="h-4 w-4 animate-spin text-purple-300" /> : reached ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <div className="h-4 w-4 rounded-full border border-zinc-600" />}
                <p className={reached ? "text-zinc-100" : "text-zinc-500"}>{index + 1}. {step.label}</p>
              </div>
            );
          })}

          {bridgeStatus === "submitted" ? (
            <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2 text-sm text-emerald-200">
              XCM call accepted on Hub. Destination delivery is asynchronous and not yet verified in this UI.
            </p>
          ) : null}

          {lastTxHash ? (
            <p className="break-all rounded-md border border-white/10 bg-black/20 p-2 text-xs text-zinc-400">
              Last tx: {" "}
              <a
                href={txUrl(lastTxHash)}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-300 underline underline-offset-2 hover:text-emerald-200"
              >
                {lastTxHash}
              </a>
            </p>
          ) : null}

          {xcmTxProof ? (
            <div className="space-y-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
              <p>Precompile call proof</p>
              <p className="break-all">
                hash: {" "}
                <a
                  href={txUrl(xcmTxProof.hash)}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 hover:text-emerald-100"
                >
                  {xcmTxProof.hash}
                </a>
              </p>
              <p>gas used: {xcmTxProof.gasUsed}</p>
              <p>status: {xcmTxProof.status}</p>
              <p>block: {xcmTxProof.blockNumber}</p>
              <p className="break-all">dest: {xcmTxProof.destHex}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {bridgeStatus === "submitted" && (
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
              <p className="font-mono break-all text-zinc-400">{destinationBytesPreview || destinationBytes}</p>
              <p className="mt-1 text-xs text-zinc-500">SCALE-encoded MultiLocation (Relay = parent chain; Parachain = paraId junction).</p>
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
