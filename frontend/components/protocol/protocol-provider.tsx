"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { toast } from "sonner";
import { usePolkadollarBackend } from "@/hooks/use-polkadollar-backend";

type Regime = "LOW" | "MEDIUM" | "HIGH" | "EXTREME";

type RiskState = {
  regime: Regime;
  ratioBps: number;
  volatilityPct: number;
};

type PositionState = {
  collateral: string;
  debt: string;
  healthFactor: string;
  pusdBalance: string;
  dotPrice: string;
};

type ProtocolStats = {
  tvlUsd: string;
  pusdSupply: string;
  activePositions: number;
};

type PricePoint = {
  day: string;
  price: number;
};

type RatioPoint = {
  day: string;
  ratioPct: number;
  regime: Regime;
  volatilityPct: number;
};

type BridgeStatus = "idle" | "encoding" | "submitting" | "confirming" | "submitted" | "failed";

type ProtocolContextValue = {
  loading: boolean;
  error: string | null;
  wallet: string;
  status: string;
  networkName: string;
  lastTxHash: string;
  lastUpdatedAt: string | null;
  position: PositionState;
  riskState: RiskState;
  stats: ProtocolStats;
  priceHistory: PricePoint[];
  ratioHistory: RatioPoint[];
  bridgeStatus: BridgeStatus;
  xcmDestination: string;
  xcmPrecompile: string;
  oracleStale: boolean;
  connectWallet: () => Promise<void>;
  switchNetwork: () => Promise<void>;
  refresh: (address?: string, silent?: boolean) => Promise<void>;
  depositCollateral: (amount: string) => Promise<void>;
  withdrawCollateral: (amount: string) => Promise<void>;
  mintPusd: (amount: string) => Promise<void>;
  burnPusd: (amount: string) => Promise<void>;
  sendCrossChain: (destHex: string, messageHex: string) => Promise<void>;
  liquidatePosition: (target: string) => Promise<void>;
  getVaultStateFor: (address: string) => Promise<{ collateral: string; debt: string; healthFactor: string }>;
};

const ProtocolContext = createContext<ProtocolContextValue | null>(null);

const REGIME_LABELS: Record<number, Regime> = {
  0: "LOW",
  1: "MEDIUM",
  2: "HIGH",
  3: "EXTREME",
};

const REGIME_RATIO_BPS: Record<Regime, number> = {
  LOW: 13000,
  MEDIUM: 15000,
  HIGH: 18000,
  EXTREME: 22000,
};

const VARIANCE_THRESHOLDS = {
  low: 1_000_000_000_000_000_000_000,
  medium: 4_000_000_000_000_000_000_000,
  high: 9_000_000_000_000_000_000_000,
};

const MAX_REASONABLE_VARIANCE = 10n ** 28n;

function shortAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function thresholdToVolatilityPct(threshold: number): number {
  return (Math.sqrt(threshold) / 1_000_000_000_000) * 100;
}

function classifyRegime(volatilityPct: number): Regime {
  const t1 = thresholdToVolatilityPct(VARIANCE_THRESHOLDS.low);
  const t2 = thresholdToVolatilityPct(VARIANCE_THRESHOLDS.medium);
  const t3 = thresholdToVolatilityPct(VARIANCE_THRESHOLDS.high);

  if (volatilityPct < t1) return "LOW";
  if (volatilityPct < t2) return "MEDIUM";
  if (volatilityPct < t3) return "HIGH";
  return "EXTREME";
}

function regimeProxyVolatility(regime: Regime): number {
  return thresholdToVolatilityPct(
    regime === "LOW"
      ? VARIANCE_THRESHOLDS.low * 0.6
      : regime === "MEDIUM"
        ? VARIANCE_THRESHOLDS.medium * 0.8
        : regime === "HIGH"
          ? VARIANCE_THRESHOLDS.high * 0.85
          : VARIANCE_THRESHOLDS.high * 1.2
  );
}

function computeEwmaSeries(history: PricePoint[]): RatioPoint[] {
  let variance = 0;
  let prev = 0;

  return history.map((entry) => {
    const p = entry.price;
    if (prev > 0) {
      const ret = Math.abs((p - prev) / prev);
      const retSq = ret * ret;
      variance = variance * 0.94 + retSq * 0.06;
    }
    prev = p;

    const volatilityPct = Math.sqrt(variance) * 100;
    const regime = classifyRegime(volatilityPct);

    return {
      day: entry.day,
      ratioPct: REGIME_RATIO_BPS[regime] / 100,
      regime,
      volatilityPct,
    };
  });
}

function inferTrend(points: PricePoint[]): number {
  if (points.length < 2) return 0;
  const last = points[points.length - 1].price;
  const prev = points[points.length - 2].price;
  if (prev === 0) return 0;
  return ((last - prev) / prev) * 100;
}

export function ProtocolProvider({ children }: { children: React.ReactNode }) {
  const backend = usePolkadollarBackend();

  const [wallet, setWallet] = useState("");
  const [status, setStatus] = useState("Idle");
  const [lastTxHash, setLastTxHash] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>("idle");
  const [oracleStale, setOracleStale] = useState(false);

  const [position, setPosition] = useState<PositionState>({
    collateral: "0",
    debt: "0",
    healthFactor: "-",
    pusdBalance: "0",
    dotPrice: "0",
  });

  const [riskState, setRiskState] = useState<RiskState>({
    regime: "LOW",
    ratioBps: 13000,
    volatilityPct: 0,
  });

  const [stats, setStats] = useState<ProtocolStats>({
    tvlUsd: "0",
    pusdSupply: "0",
    activePositions: 0,
  });

  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [ratioHistory, setRatioHistory] = useState<RatioPoint[]>([]);

  const readProvider = useMemo(() => new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL || "https://eth-rpc-testnet.polkadot.io/"), []);

  const fetchRiskState = useCallback(async () => {
    const riskContract = new ethers.Contract(
      backend.addresses.riskEngine,
      ["function assessRisk() returns (uint8 regime, uint256 ratio)"],
      readProvider
    );

    const [regime, ratio] = await riskContract.assessRisk.staticCall();
    const normalizedRegime = REGIME_LABELS[Number(regime)] || "LOW";
    const proxyVolatility = regimeProxyVolatility(normalizedRegime);

    // Attempt to read real EWMA variance using getVariance() selector 0x3e09e777
    let volatilityPct: number;
    try {
      const raw = await readProvider.call({
        to: backend.addresses.riskEngine,
        data: "0x3e09e777",
      });
      const [varianceRaw] = ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], raw) as [bigint];
      if (varianceRaw < 0n || varianceRaw > MAX_REASONABLE_VARIANCE) {
        throw new Error("variance out of expected range");
      }
      // variance is stored as (return * SCALE)^2 — recover σ = sqrt(variance) / SCALE
      const varianceF = Number(varianceRaw) / 1_000_000_000_000_000_000_000_000;
      volatilityPct = Math.sqrt(varianceF) * 100;
      if (!Number.isFinite(volatilityPct) || volatilityPct < 0 || volatilityPct > 1000) {
        throw new Error("computed volatility invalid");
      }
    } catch {
      // Fallback to regime-bucket proxy if contract hasn't been redeployed with getVariance yet
      volatilityPct = proxyVolatility;
    }

    return {
      regime: normalizedRegime,
      ratioBps: Number(ratio),
      volatilityPct,
    } satisfies RiskState;
  }, [backend.addresses.riskEngine, readProvider]);

  const fetchProtocolStats = useCallback(async (dotPrice: string, collateral: string) => {
    const pusd = new ethers.Contract(
      backend.addresses.pusd,
      ["function totalSupply() view returns (uint256)"],
      readProvider
    );

    const [totalSupply, vaultBalance] = await Promise.all([
      pusd.totalSupply(),
      readProvider.getBalance(backend.addresses.vault),
    ]);

    const tvlUsd = Number(ethers.formatEther(vaultBalance)) * Number(dotPrice || "0");
    const connectedHasPosition = Number(collateral || "0") > 0 ? 1 : 0;

    setStats({
      tvlUsd: tvlUsd.toFixed(2),
      pusdSupply: Number(ethers.formatEther(totalSupply)).toFixed(2),
      activePositions: connectedHasPosition,
    });
  }, [backend.addresses.pusd, backend.addresses.vault, readProvider]);

  const fetchHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/market-history?days=60", { cache: "no-store" });
      if (!response.ok) return;

      const json = (await response.json()) as { points: PricePoint[] };
      if (!Array.isArray(json.points) || json.points.length === 0) return;

      const thirtyDay = json.points.slice(-30);
      setPriceHistory(thirtyDay);
      setRatioHistory(computeEwmaSeries(thirtyDay));
    } catch {
      // Ignore history fetch failures, live protocol flows should keep working.
    }
  }, []);

  const refresh = useCallback(async (address = wallet, silent = false) => {
    if (!address) {
      if (!silent) setStatus("Connect wallet first");
      return;
    }

    backend.clearError();
    if (!silent) {
      setStatus("Refreshing protocol state...");
    }

    const priceFeedContract = new ethers.Contract(
      backend.addresses.priceFeed,
      ["function lastUpdatedAt() view returns (uint256)"],
      readProvider
    );
    const [vaultStateResult, balanceResult, priceResult, riskResult, oracleResult] = await Promise.allSettled([
      backend.getVaultState(address),
      backend.getPusdBalance(address),
      backend.getCurrentPrice(),
      fetchRiskState(),
      priceFeedContract.lastUpdatedAt() as Promise<bigint>,
    ]);

    const errors: string[] = [];
    let successCount = 0;

    const positionUpdate: Partial<PositionState> = {};

    if (vaultStateResult.status === "fulfilled") {
      positionUpdate.collateral = vaultStateResult.value.collateral;
      positionUpdate.debt = vaultStateResult.value.debt;
      positionUpdate.healthFactor = vaultStateResult.value.healthFactor;
      successCount += 1;
    } else {
      errors.push("vault");
    }

    if (balanceResult.status === "fulfilled") {
      positionUpdate.pusdBalance = balanceResult.value;
      successCount += 1;
    } else {
      errors.push("balance");
    }

    if (priceResult.status === "fulfilled") {
      positionUpdate.dotPrice = priceResult.value;
      successCount += 1;
    } else {
      errors.push("price");
    }

    if (riskResult.status === "fulfilled") {
      setRiskState(riskResult.value);
      successCount += 1;
    } else {
      errors.push("risk");
    }

    if (oracleResult.status === "fulfilled") {
      setOracleStale(Math.floor(Date.now() / 1000) - Number(oracleResult.value) > 1800);
    }

    setPosition((prev) => ({ ...prev, ...positionUpdate }));
    setLastUpdatedAt(new Date().toLocaleTimeString());

    const latestPrice = positionUpdate.dotPrice;
    const latestCollateral = positionUpdate.collateral;
    if (latestPrice && latestPrice !== "0") {
      await fetchProtocolStats(latestPrice, latestCollateral ?? "0");
    }

    if (successCount === 0) {
      setStatus(`Refresh failed: ${errors.join(", ")}`);
    } else if (errors.length > 0) {
      setStatus(`Partial refresh (${successCount}/4): ${errors.join(", ")}`);
    } else if (!silent) {
      setStatus("State refreshed");
    }
  }, [backend, fetchProtocolStats, fetchRiskState, wallet]);

  const txInFlightRef = useRef(false);

  const executeAction = useCallback(async (label: string, action: () => Promise<{ hash: string }>) => {
    if (txInFlightRef.current) {
      toast.warning("A transaction is already in progress. Wait for it to confirm.");
      return;
    }
    txInFlightRef.current = true;
    backend.clearError();
    setStatus(`${label} confirming...`);

    const submitToast = toast.loading(`${label}: waiting for wallet confirmation`);
    try {
      const result = await action();
      setLastTxHash(result.hash);
      toast.success(`${label} confirmed`, { id: submitToast });
      setStatus(`${label} confirmed`);
      await refresh(wallet, true);
    } catch (err) {
      const message = err instanceof Error ? err.message : `${label} failed`;
      toast.error(message, { id: submitToast });
      setStatus(`${label} failed: ${message}`);
      throw err;
    } finally {
      txInFlightRef.current = false;
    }
  }, [backend, refresh, wallet]);

  const connectWallet = useCallback(async () => {
    const address = await backend.connectWallet();
    setWallet(address);
    setStatus(`Connected ${shortAddress(address)}`);
    await refresh(address, true);
    toast.success(`Wallet connected: ${shortAddress(address)}`);
  }, [backend, refresh]);

  const switchNetwork = useCallback(async () => {
    await backend.switchNetwork();
    setStatus("Switched to Polkadot Hub TestNet");
    if (wallet) {
      await refresh(wallet, true);
    }
  }, [backend, refresh, wallet]);

  const depositCollateral = useCallback(async (amount: string) => {
    await executeAction("Deposit", () => backend.depositCollateral(amount));
  }, [backend, executeAction]);

  const withdrawCollateral = useCallback(async (amount: string) => {
    await executeAction("Withdraw", () => backend.withdrawCollateral(amount));
  }, [backend, executeAction]);

  const mintPusd = useCallback(async (amount: string) => {
    await executeAction("Mint", () => backend.mintPusd(amount));
  }, [backend, executeAction]);

  const burnPusd = useCallback(async (amount: string) => {
    await executeAction("Burn", () => backend.burnPusd(amount));
  }, [backend, executeAction]);

  const liquidatePosition = useCallback(async (target: string) => {
    await executeAction("Liquidate", () => backend.liquidatePosition(target));
  }, [backend, executeAction]);

  const sendCrossChain = useCallback(async (destHex: string, messageHex: string) => {
    setBridgeStatus("encoding");
    await new Promise((resolve) => setTimeout(resolve, 350));
    setBridgeStatus("submitting");

    await executeAction("XCM send", async () => {
      const result = await backend.sendXcm(destHex, messageHex);
      setBridgeStatus("confirming");
      return result;
    });

    setBridgeStatus("submitted");
  }, [backend, executeAction]);

  const getVaultStateFor = useCallback(async (address: string) => {
    return backend.getVaultState(address);
  }, [backend]);

  // Fetch risk state + price on mount so the dashboard never shows stale defaults
  useEffect(() => {
    const bootstrap = async () => {
      const pf = new ethers.Contract(
        backend.addresses.priceFeed,
        ["function lastUpdatedAt() view returns (uint256)"],
        readProvider
      );
      const [riskResult, priceResult, oracleResult] = await Promise.allSettled([
        fetchRiskState(),
        backend.getCurrentPrice(),
        pf.lastUpdatedAt() as Promise<bigint>,
      ]);
      if (riskResult.status === "fulfilled") setRiskState(riskResult.value);
      if (priceResult.status === "fulfilled") {
        setPosition((prev) => ({ ...prev, dotPrice: priceResult.value }));
      }
      if (oracleResult.status === "fulfilled") {
        setOracleStale(Math.floor(Date.now() / 1000) - Number(oracleResult.value) > 1800);
      }
    };
    void bootstrap();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    if (!wallet) return;

    const id = setInterval(() => {
      void refresh(wallet, true);
    }, 15000);

    return () => clearInterval(id);
  }, [wallet, refresh]);

  const contextValue = useMemo<ProtocolContextValue>(() => ({
    loading: backend.loading,
    error: backend.error,
    wallet,
    status,
    networkName: "Polkadot Hub TestNet",
    lastTxHash,
    lastUpdatedAt,
    position,
    riskState,
    stats,
    priceHistory,
    ratioHistory,
    bridgeStatus,
    xcmDestination: backend.xcmDestHydration,
    xcmPrecompile: backend.addresses.xcmPrecompile,
    oracleStale,
    connectWallet,
    switchNetwork,
    refresh,
    depositCollateral,
    withdrawCollateral,
    mintPusd,
    burnPusd,
    sendCrossChain,
    liquidatePosition,
    getVaultStateFor,
  }), [
    backend.addresses.xcmPrecompile,
    backend.error,
    backend.loading,
    backend.xcmDestHydration,
    bridgeStatus,
    burnPusd,
    connectWallet,
    depositCollateral,
    lastTxHash,
    lastUpdatedAt,
    mintPusd,
    liquidatePosition,
    position,
    priceHistory,
    ratioHistory,
    refresh,
    riskState,
    sendCrossChain,
    getVaultStateFor,
    oracleStale,
    stats,
    status,
    switchNetwork,
    wallet,
    withdrawCollateral,
  ]);

  return <ProtocolContext.Provider value={contextValue}>{children}</ProtocolContext.Provider>;
}

export function useProtocol() {
  const context = useContext(ProtocolContext);
  if (!context) {
    throw new Error("useProtocol must be used inside ProtocolProvider");
  }
  return context;
}

export function usePriceDirection() {
  const { priceHistory } = useProtocol();
  return inferTrend(priceHistory);
}
