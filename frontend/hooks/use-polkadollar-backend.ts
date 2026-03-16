"use client";

import { useState, useCallback } from "react";
import { ethers } from "ethers";

type BackendConfig = {
  vaultAddress: string;
  pusdAddress: string;
  priceFeedAddress: string;
  riskEngineAddress: string;
  xcmPrecompile: string;
  xcmDestHydration: string;
  rpcUrl: string;
  chainId: number;
  chainName: string;
  currencySymbol: string;
  explorerUrl: string;
};

type TxResult = {
  hash: string;
  receipt: ethers.TransactionReceipt | null;
};

type TxOverrides = {
  gasLimit: bigint;
  gasPrice: bigint;
};

type VaultState = {
  collateral: string;
  debt: string;
  healthFactor: string;
};

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  isMetaMask?: boolean;
  providers?: EthereumProvider[];
};

type RpcLikeError = {
  code?: string;
  shortMessage?: string;
  reason?: string;
  message?: string;
  error?: { message?: string; code?: number | string; data?: unknown };
  info?: { error?: { message?: string; code?: number | string; data?: unknown } };
  data?: unknown;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const config: BackendConfig = {
  vaultAddress: process.env.NEXT_PUBLIC_VAULT_ADDRESS || "0x54Dc42542E36F10b5Ff8B60A00cf1e48278006ae",
  pusdAddress: process.env.NEXT_PUBLIC_PUSD_ADDRESS || "0x876df4BBD21ec38f78D6AEbF9687a89445821BE7",
  priceFeedAddress: process.env.NEXT_PUBLIC_PRICE_FEED_ADDRESS || "0xCDe170C92E281757aD961Ba47B33DFacd827a761",
  riskEngineAddress: process.env.NEXT_PUBLIC_RISK_ENGINE_ADDRESS || "0x1a5b66d8b4170213696D7a0Ec465fFF165E6ba2B",
  xcmPrecompile: process.env.NEXT_PUBLIC_XCM_PRECOMPILE || "0x000000000000000000000000000000000000A000",
  xcmDestHydration: process.env.NEXT_PUBLIC_XCM_DEST_HYDRATION || "0x040100",
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "https://eth-rpc-testnet.polkadot.io/",
  chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID || "420420417"),
  chainName: process.env.NEXT_PUBLIC_CHAIN_NAME || "Polkadot Hub TestNet",
  currencySymbol: process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || "PAS",
  explorerUrl: process.env.NEXT_PUBLIC_EXPLORER_URL || "https://blockscout-testnet.polkadot.io/",
};

/**
 * Hook for interacting with the Polkadollar contracts
 */
export function usePolkadollarBackend() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const getInjectedProvider = useCallback((): EthereumProvider => {
    if (typeof window === "undefined" || !window.ethereum) {
      throw new Error("No injected wallet found. Install MetaMask or open in wallet browser.");
    }

    const injected = window.ethereum;
    if (Array.isArray(injected.providers) && injected.providers.length > 0) {
      const metaMask = injected.providers.find((p) => p.isMetaMask);
      return metaMask || injected.providers[0];
    }

    return injected;
  }, []);

  const getBrowserProvider = useCallback(() => {
    const injected = getInjectedProvider();
    return new ethers.BrowserProvider(injected);
  }, [getInjectedProvider]);

  const getReadProvider = useCallback(() => {
    return new ethers.JsonRpcProvider(config.rpcUrl);
  }, []);

  const getSigner = useCallback(async () => {
    const provider = getBrowserProvider();
    await provider.send("eth_requestAccounts", []);
    return await provider.getSigner();
  }, [getBrowserProvider]);

  const extractErrorMessage = useCallback((err: unknown, fallback: string): string => {
    const e = err as RpcLikeError;

    const nestedMessage =
      e?.error?.message ||
      e?.info?.error?.message ||
      (typeof e?.data === "string" ? e.data : undefined);

    if (e?.reason) return e.reason;

    if (e?.message?.toLowerCase().includes("could not coalesce error") && nestedMessage) {
      return nestedMessage;
    }

    if (nestedMessage) return nestedMessage;
    if (e?.shortMessage) return e.shortMessage;
    if (e?.message) return e.message;

    return fallback;
  }, []);

  const withLoading = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      const message = extractErrorMessage(err, "Transaction failed");
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, [extractErrorMessage]);

  const parsePositiveAmount = useCallback((value: string, unitLabel: string): bigint => {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new Error(`${unitLabel} amount is required`);
    }
    const parsed = ethers.parseEther(trimmed);
    if (parsed <= BigInt(0)) {
      throw new Error(`${unitLabel} amount must be greater than 0`);
    }
    return parsed;
  }, []);

  const getTxOverrides = useCallback(async (provider: ethers.Provider, gasLimit: bigint): Promise<TxOverrides> => {
    const fee = await provider.getFeeData();
    const fallbackGasPrice = ethers.parseUnits("1000", "gwei");
    return {
      gasLimit,
      gasPrice: fee.gasPrice ?? fee.maxFeePerGas ?? fallbackGasPrice,
    };
  }, []);

  const assertWriteContext = useCallback(
    async (
      signer: ethers.Signer,
      contractAddress: string,
      contractName: string,
      options?: { allowNoCode?: boolean }
    ) => {
      const provider = signer.provider;
      if (!provider) {
        throw new Error("No provider connected");
      }

      const network = await provider.getNetwork();
      const currentChainId = Number(network.chainId);
      if (currentChainId !== config.chainId) {
        throw new Error(`Wrong network: connected to chain ${currentChainId}, expected ${config.chainId}`);
      }

      const code = await provider.getCode(contractAddress);
      if ((!code || code === "0x") && !options?.allowNoCode) {
        throw new Error(`${contractName} not deployed at ${contractAddress} on chain ${config.chainId}`);
      }
    },
    []
  );

  const toReadableError = useCallback((err: unknown, fallback: string): Error => {
    const e = err as RpcLikeError;
    const message = extractErrorMessage(err, fallback);

    if (e?.reason) {
      return new Error(e.reason);
    }

    if (e?.code === "CALL_EXCEPTION" && !e?.reason) {
      return new Error(
        `${message}. This usually means wrong network, wrong contract address, or a reverted require() check.`
      );
    }

    return new Error(message || fallback);
  }, [extractErrorMessage]);

  // ============ VAULT INTERACTIONS ============

  const depositCollateral = useCallback(
    async (amountDot: string) => {
      return withLoading(async () => {
        try {
          const signer = await getSigner();
          await assertWriteContext(signer, config.vaultAddress, "CollateralVault");
          const depositValue = parsePositiveAmount(amountDot, "Deposit");
          const provider = signer.provider;
          if (!provider) throw new Error("No provider connected");
          const overrides = await getTxOverrides(provider, BigInt(300000));

          const vault = new ethers.Contract(config.vaultAddress, ["function deposit() payable"], signer);

          const tx = await vault.deposit({
            value: depositValue,
            ...overrides,
          });
          const receipt = await tx.wait();
          return { hash: tx.hash, receipt };
        } catch (err) {
          throw toReadableError(err, "Deposit failed");
        }
      });
    },
    [assertWriteContext, getSigner, getTxOverrides, parsePositiveAmount, toReadableError, withLoading]
  );

  const mintPusd = useCallback(
    async (amount: string): Promise<TxResult> => {
      return withLoading(async () => {
        try {
          const signer = await getSigner();
          await assertWriteContext(signer, config.vaultAddress, "CollateralVault");
          const mintValue = parsePositiveAmount(amount, "Mint");
          const provider = signer.provider;
          if (!provider) throw new Error("No provider connected");
          const overrides = await getTxOverrides(provider, BigInt(350000));
          const vault = new ethers.Contract(config.vaultAddress, ["function mint(uint256 amount)"], signer);

          const tx = await vault.mint(mintValue, overrides);
          const receipt = await tx.wait();
          return { hash: tx.hash, receipt };
        } catch (err) {
          throw toReadableError(err, "Mint failed");
        }
      });
    },
    [assertWriteContext, getSigner, getTxOverrides, parsePositiveAmount, toReadableError, withLoading]
  );

  const burnPusd = useCallback(
    async (amount: string): Promise<TxResult> => {
      return withLoading(async () => {
        try {
          const signer = await getSigner();
          await assertWriteContext(signer, config.vaultAddress, "CollateralVault");
          const burnValue = parsePositiveAmount(amount, "Burn");
          const provider = signer.provider;
          if (!provider) throw new Error("No provider connected");
          const overrides = await getTxOverrides(provider, BigInt(350000));
          const vault = new ethers.Contract(config.vaultAddress, ["function burn(uint256 amount)"], signer);

          const tx = await vault.burn(burnValue, overrides);
          const receipt = await tx.wait();
          return { hash: tx.hash, receipt };
        } catch (err) {
          throw toReadableError(err, "Burn failed");
        }
      });
    },
    [assertWriteContext, getSigner, getTxOverrides, parsePositiveAmount, toReadableError, withLoading]
  );

  const withdrawCollateral = useCallback(
    async (amountDot: string): Promise<TxResult> => {
      return withLoading(async () => {
        try {
          const signer = await getSigner();
          await assertWriteContext(signer, config.vaultAddress, "CollateralVault");
          const withdrawValue = parsePositiveAmount(amountDot, "Withdraw");
          const provider = signer.provider;
          if (!provider) throw new Error("No provider connected");
          const overrides = await getTxOverrides(provider, BigInt(350000));
          const vault = new ethers.Contract(config.vaultAddress, ["function withdraw(uint256 amount)"], signer);

          const tx = await vault.withdraw(withdrawValue, overrides);
          const receipt = await tx.wait();
          return { hash: tx.hash, receipt };
        } catch (err) {
          throw toReadableError(err, "Withdraw failed");
        }
      });
    },
    [assertWriteContext, getSigner, getTxOverrides, parsePositiveAmount, toReadableError, withLoading]
  );

  const getVaultState = useCallback(
    async (address: string): Promise<VaultState> => {
      const provider = getReadProvider();

        const vault = new ethers.Contract(
          config.vaultAddress,
          [
            "function collateral(address) view returns (uint256)",
            "function debt(address) view returns (uint256)",
            "function healthFactor(address) view returns (uint256)",
          ],
          provider
        );

      const [collateral, debt, healthFactor] = await Promise.all([
        vault.collateral(address),
        vault.debt(address),
        vault.healthFactor(address),
      ]);

      return {
        collateral: ethers.formatEther(collateral),
        debt: ethers.formatEther(debt),
        healthFactor:
          healthFactor.toString() ===
          "115792089237316195423570985008687907853269984665640564039457584007913129639935"
            ? "Infinity"
            : (Number(healthFactor) / 10000).toFixed(4),
      };
    },
    [getReadProvider]
  );

  const getPusdBalance = useCallback(
    async (address: string) => {
      const provider = getReadProvider();

        const pusd = new ethers.Contract(
          config.pusdAddress,
          ["function balanceOf(address) view returns (uint256)"],
          provider
        );

        const balance = await pusd.balanceOf(address);
        return ethers.formatEther(balance);
    },
    [getReadProvider]
  );

  const getCurrentPrice = useCallback(async () => {
    const provider = getReadProvider();

      const feed = new ethers.Contract(
        config.priceFeedAddress,
        ["function price() view returns (uint256)"],
        provider
      );

      const price = await feed.price();
      return ethers.formatEther(price); // Convert from 18 decimals
  }, [getReadProvider]);

  const sendXcmToHydration = useCallback(
    async (messageHex: string): Promise<TxResult> => {
      return withLoading(async () => {
        try {
          if (!ethers.isHexString(messageHex)) {
            throw new Error("Message must be a valid hex string");
          }

          const signer = await getSigner();
          await assertWriteContext(signer, config.xcmPrecompile, "XCM precompile", { allowNoCode: true });
          const provider = signer.provider;
          if (!provider) throw new Error("No provider connected");
          const overrides = await getTxOverrides(provider, BigInt(500000));

          const xcmInterface = new ethers.Interface([
            "function send(bytes dest, bytes message) returns (bool)",
          ]);

          const tx = await signer.sendTransaction({
            to: config.xcmPrecompile,
            data: xcmInterface.encodeFunctionData("send", [
              config.xcmDestHydration,
              messageHex,
            ]),
            ...overrides,
          });

          const receipt = await tx.wait();
          return { hash: tx.hash, receipt };
        } catch (err) {
          throw toReadableError(err, "XCM send failed");
        }
      });
    },
    [assertWriteContext, getSigner, getTxOverrides, toReadableError, withLoading]
  );

  const ensureExpectedNetwork = useCallback(async () => {
    const provider = getBrowserProvider();
    const network = await provider.getNetwork();
    const currentChainId = Number(network.chainId);
    if (currentChainId === config.chainId) {
      return;
    }

    if (!window.ethereum) {
      throw new Error("No wallet");
    }

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${config.chainId.toString(16)}` }],
      });
    } catch (err: any) {
      if (err.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: `0x${config.chainId.toString(16)}`,
              rpcUrls: [config.rpcUrl],
              chainName: config.chainName,
              nativeCurrency: { name: config.currencySymbol, symbol: config.currencySymbol, decimals: 18 },
              blockExplorerUrls: [config.explorerUrl],
            },
          ],
        });
      } else {
        throw err;
      }
    }
  }, [getBrowserProvider]);

  const switchNetwork = useCallback(async () => {
    await ensureExpectedNetwork();
  }, [ensureExpectedNetwork]);

  const connectWallet = useCallback(async () => {
    return withLoading(async () => {
      const provider = getBrowserProvider();

      const existing = (await provider.send("eth_accounts", [])) as string[];
      if (!existing || existing.length === 0) {
        await provider.send("eth_requestAccounts", []);
      }

      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      if (!address) {
        throw new Error("Wallet connected but no account was returned.");
      }

      return address;
    });
  }, [getBrowserProvider, withLoading]);

  return {
    // State
    loading,
    error,
    clearError,

    // Wallet
    connectWallet,

    // Vault
    depositCollateral,
    withdrawCollateral,
    getVaultState,

    // pUSD
    mintPusd,
    burnPusd,
    getPusdBalance,

    // Price
    getCurrentPrice,

    // XCM
    sendXcmToHydration,

    // Utility
    switchNetwork,

    // Config
    addresses: {
      vault: config.vaultAddress,
      pusd: config.pusdAddress,
      priceFeed: config.priceFeedAddress,
      riskEngine: config.riskEngineAddress,
      xcmPrecompile: config.xcmPrecompile,
    },
    xcmDestHydration: config.xcmDestHydration,
    chainId: config.chainId,
  };
}
