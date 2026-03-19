"use client";

import { FormEvent, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, Minus, Move } from "lucide-react";
import { useProtocol } from "@/components/protocol/protocol-provider";
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
  { id: "hydration", label: "Hydration", kind: "parachain", paraId: Number(process.env.NEXT_PUBLIC_HYDRATION_PARA_ID || "2034"), note: "Hydration parachain destination." },
  { id: "acala", label: "Acala", kind: "parachain", paraId: Number(process.env.NEXT_PUBLIC_ACALA_PARA_ID || "2000"), note: "Verify paraId for the current network before sending." },
  { id: "moonbeam", label: "Moonbeam", kind: "parachain", paraId: Number(process.env.NEXT_PUBLIC_MOONBEAM_PARA_ID || "2004"), note: "Verify paraId for the current network before sending." },
  { id: "astar", label: "Astar", kind: "parachain", paraId: Number(process.env.NEXT_PUBLIC_ASTAR_PARA_ID || "2006"), note: "Verify paraId for the current network before sending." },
  { id: "bifrost", label: "Bifrost", kind: "parachain", paraId: Number(process.env.NEXT_PUBLIC_BIFROST_PARA_ID || "2030"), note: "Verify paraId for the current network before sending." },
  { id: "interlay", label: "Interlay", kind: "parachain", paraId: Number(process.env.NEXT_PUBLIC_INTERLAY_PARA_ID || "2032"), note: "Verify paraId for the current network before sending." },
  { id: "custom", label: "Custom ParaId", kind: "custom", note: "Use this when your target parachain is not listed." },
];

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

function StepBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-white/[0.18] bg-black/20 p-3 space-y-2">
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-200">{label}</p>
      {children}
    </div>
  );
}

export default function BridgePage() {
  const txUrl = (hash: string) => `${EXPLORER_BASE}/tx/${hash}`;
  const { wallet, loading, bridgeStatus, position, sendCrossChain, lastTxHash, xcmTxProof, xcmDestination, xcmPrecompile } = useProtocol();

  const [destination, setDestination] = useState("hydration");
  const [amountPlanck, setAmountPlanck] = useState(DEFAULT_AMOUNT_PLANCK);
  const [executionFeePlanck, setExecutionFeePlanck] = useState(DEFAULT_EXECUTION_FEE_PLANCK);
  const [recipient, setRecipient] = useState("");
  const [xcmMessagePreview, setXcmMessagePreview] = useState("");
  const [customParaId, setCustomParaId] = useState("");
  const [destinationBytesPreview, setDestinationBytesPreview] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const selectedDestination = useMemo(() => DESTINATIONS.find((d) => d.id === destination) || DESTINATIONS[0], [destination]);

  const destinationBytes = useMemo(() => {
    if (selectedDestination.kind === "relay") return buildXcmDestinationHex({ type: "relay" });
    if (selectedDestination.kind === "parachain" && selectedDestination.paraId !== undefined)
      return buildXcmDestinationHex({ type: "parachain", paraId: selectedDestination.paraId });
    if (selectedDestination.kind === "custom") {
      if (!/^\d+$/.test(customParaId)) return "";
      return buildXcmDestinationHex({ type: "parachain", paraId: Number(customParaId) });
    }
    return xcmDestination;
  }, [customParaId, selectedDestination, xcmDestination]);

  const unsupportedDestination = !destinationBytes;

  async function onSend(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (unsupportedDestination) { setFormError("Destination bytes are not configured for this target."); return; }
    try {
      if (!/^\d+$/.test(amountPlanck)) throw new Error("Amount must be an integer in planck units");
      if (!/^\d+$/.test(executionFeePlanck)) throw new Error("Execution fee must be an integer in planck units");
      if (selectedDestination.kind === "custom" && !/^\d+$/.test(customParaId)) throw new Error("Custom paraId must be an integer");
      const beneficiary = await parseAccountId32(recipient);
      const messageHex = buildXcmMessageHex({ beneficiaryAccountId32: beneficiary, amountPlanck: BigInt(amountPlanck), executionFeePlanck: BigInt(executionFeePlanck) });
      setDestinationBytesPreview(destinationBytes);
      setXcmMessagePreview(messageHex);
      await sendCrossChain(destinationBytes, messageHex);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to build XCM message");
    }
  }

  const steps = [
    { key: "encoding", label: "Encoding XCM" },
    { key: "submitting", label: "Submitting" },
    { key: "confirming", label: "Confirming on Hub" },
    { key: "submitted", label: "Submitted on Hub" },
  ] as const;

  const inputCls = "rounded-sm border-white/40 bg-zinc-900 font-mono text-xs !text-white placeholder:text-zinc-600";

  return (
    <section className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <h1 className="font-pixel text-5xl sm:text-6xl lg:text-7xl tracking-tight text-white">BRIDGE</h1>
        <p className="mt-1 text-sm text-zinc-500">Send pUSD cross-chain through the XCM precompile flow.</p>
      </div>

      {/* Transfer form */}
      <MbCard coords="X:0 Y:0">
        <p className="mb-1 font-mono text-xs uppercase tracking-widest text-zinc-200">Cross-Chain Transfer</p>
        <p className="mb-4 text-[11px] text-zinc-600">From Polkadot Hub to a selected parachain destination</p>

        <form onSubmit={onSend} className="space-y-3">
          <StepBox label="Step 1: Source">
            <p className="font-mono text-sm text-zinc-200">From: Polkadot Hub</p>
            <p className="font-mono text-sm text-zinc-400">pUSD Balance: <span className="text-emerald-400">{Number(position.pusdBalance || "0").toFixed(2)}</span></p>
          </StepBox>

          <StepBox label="Step 2: Destination">
            <Select value={destination} onValueChange={setDestination}>
              <SelectTrigger className="rounded-sm border-white/40 bg-zinc-900 font-mono text-xs !text-white">
                <SelectValue placeholder="Select destination" />
              </SelectTrigger>
              <SelectContent className="rounded-sm border-white/[0.18] bg-[#0d0f13] font-mono text-xs text-zinc-200">
                {DESTINATIONS.map((item) => (
                  <SelectItem key={item.id} value={item.id} className="font-mono text-xs text-zinc-200 focus:bg-zinc-800 focus:text-white">
                    {item.kind === "relay" ? `${item.label} (Parent chain, no paraId)` : item.kind === "custom" ? item.label : `${item.label} (ParaID ${item.paraId})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedDestination.kind === "custom" && (
              <Input value={customParaId} onChange={(e) => setCustomParaId(e.target.value)} placeholder="Enter parachain paraId (example: 2034)" className={inputCls} />
            )}
            <p className="font-mono text-[10px] text-zinc-600 break-all">Destination bytes: {destinationBytes}</p>
            <p className="font-mono text-[10px] text-zinc-600">{selectedDestination.note}</p>
          </StepBox>

          <StepBox label="Step 3: Amount (Planck)">
            <Input value={amountPlanck} onChange={(e) => setAmountPlanck(e.target.value)} placeholder="Amount in planck" className={inputCls} />
            <p className="font-mono text-[10px] text-zinc-600">Use integer planck units for the XCM asset amount.</p>
          </StepBox>

          <StepBox label="Step 4: Recipient">
            <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Hydration ss58 or 0x AccountId32" className={inputCls} />
            <p className="font-mono text-[10px] text-zinc-600">Recipient must resolve to AccountId32 on destination chain.</p>
          </StepBox>

          <StepBox label="Step 5: Execution Fee (Planck)">
            <Input value={executionFeePlanck} onChange={(e) => setExecutionFeePlanck(e.target.value)} placeholder="Execution fee in planck" className={inputCls} />
          </StepBox>

          <StepBox label="Step 6: Review">
            <p className="font-mono text-sm text-zinc-200">Send XCM payload from Polkadot Hub to {selectedDestination.label}</p>
            <p className="font-mono text-[10px] text-zinc-600">Estimated delivery: ~30 seconds (testnet)</p>
            <Input value={xcmMessagePreview} readOnly placeholder="XCM message preview appears after validation/send" className={inputCls} />
            <button
              type="submit"
              disabled={loading || !wallet || unsupportedDestination}
              style={{ color: '#ffffff', background: '#18181b', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '2px', padding: '8px 16px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontFamily: 'monospace', fontSize: '12px', cursor: (loading || !wallet || unsupportedDestination) ? 'not-allowed' : 'pointer', opacity: (loading || !wallet || unsupportedDestination) ? 0.4 : 1 }}
            >
              Send Cross-Chain
              <ArrowRight style={{ width: 14, height: 14, color: '#ffffff' }} />
            </button>
            {unsupportedDestination && <p className="font-mono text-[10px] text-yellow-400">Set NEXT_PUBLIC_XCM_DEST_HYDRATION with valid destination bytes to enable this path.</p>}
            {formError && <p className="font-mono text-[10px] text-red-400">{formError}</p>}
          </StepBox>
        </form>
      </MbCard>

      {/* Asset semantics */}
      <MbCard coords="X:1 Y:0">
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-sm border border-yellow-500/30 bg-black px-2 py-0.5 font-mono text-[10px] tracking-widest text-yellow-400">IMPORTANT</span>
          <p className="font-mono text-xs uppercase tracking-widest text-zinc-200">Asset Semantics</p>
        </div>
      
        <p className="font-mono text-[11px] text-emerald-400">
          The precompile accepted our XCM message. On mainnet with registered assets, pUSD arrives cross-chain.
        </p>
      </MbCard>

      {/* Transaction status */}
      <MbCard coords="X:0 Y:1">
        <p className="mb-1 font-mono text-xs uppercase tracking-widest text-zinc-200">Transaction Status</p>
        <p className="mb-4 text-[11px] text-zinc-600">End-to-end XCM flow progress</p>

        <div className="space-y-3">
          {steps.map((step, index) => {
            const order = ["encoding", "submitting", "confirming", "submitted"];
            const reached = order.indexOf(step.key) <= order.indexOf(bridgeStatus === "failed" ? "encoding" : bridgeStatus);
            const current = bridgeStatus === step.key && bridgeStatus !== "submitted";
            return (
              <div key={step.key} className="flex items-center gap-3">
                {current
                  ? <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                  : reached
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    : <div className="h-4 w-4 rounded-full border border-zinc-700" />}
                <p className={`font-mono text-xs ${reached ? "text-zinc-100" : "text-zinc-600"}`}>{index + 1}. {step.label}</p>
              </div>
            );
          })}

          {bridgeStatus === "submitted" && (
            <p className="rounded-sm border border-emerald-500/30 bg-black p-2 font-mono text-xs text-emerald-400">
              XCM call accepted on Hub. Destination delivery is asynchronous and not yet verified in this UI.
            </p>
          )}

          {lastTxHash && (
            <p className="break-all rounded-sm border border-white/[0.18] bg-black/20 p-2 font-mono text-[11px] text-zinc-500">
              Last tx:{" "}
              <a href={txUrl(lastTxHash)} target="_blank" rel="noreferrer" className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300">
                {lastTxHash}
              </a>
            </p>
          )}

          {xcmTxProof && (
            <div className="space-y-1 rounded-sm border border-emerald-500/30 bg-black p-3 font-mono text-[11px] text-emerald-400">
              <p className="text-zinc-200">Precompile call proof</p>
              <p className="break-all">hash:{" "}
                <a href={txUrl(xcmTxProof.hash)} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-emerald-300">{xcmTxProof.hash}</a>
              </p>
              <p className="text-zinc-400">gas used: {xcmTxProof.gasUsed}</p>
              <p className="text-zinc-400">status: {xcmTxProof.status}</p>
              <p className="text-zinc-400">block: {xcmTxProof.blockNumber}</p>
              <p className="break-all text-zinc-400">dest: {xcmTxProof.destHex}</p>
            </div>
          )}
        </div>
      </MbCard>

      {/* XCM precompile details */}
      {bridgeStatus === "submitted" && (
        <MbCard coords="X:1 Y:1">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-sm border border-emerald-500/30 bg-black px-2 py-0.5 font-mono text-[10px] tracking-widest text-emerald-400">POLKADOT NATIVE</span>
            <p className="font-mono text-xs uppercase tracking-widest text-zinc-200">XCM Precompile Details</p>
          </div>
          <p className="mb-3 text-[11px] text-zinc-600">How your cross-chain message was routed</p>
          <div className="space-y-3">
            <div className="rounded-sm border border-white/[0.18] bg-black/20 p-3">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Precompile Address</p>
              <p className="font-mono text-xs break-all text-zinc-200">{xcmPrecompile}</p>
            </div>
            <div className="rounded-sm border border-white/[0.18] bg-black/20 p-3">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Destination Bytes</p>
              <p className="font-mono text-xs break-all text-zinc-400">{destinationBytesPreview || destinationBytes}</p>
              <p className="mt-1 font-mono text-[10px] text-zinc-600">SCALE-encoded MultiLocation.</p>
            </div>
            <p className="font-mono text-[10px] text-zinc-600">
              The XCM precompile is a Polkadot-native feature exposed at a fixed address. Any Solidity contract on Polkadot Hub can send cross-chain messages without a bridge relayer.
            </p>
          </div>
        </MbCard>
      )}
    </section>
  );
}
