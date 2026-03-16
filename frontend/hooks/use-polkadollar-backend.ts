import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import getConfig from 'next/config';

const { publicRuntimeConfig } = getConfig();

/**
 * Hook for interacting with the Polkadollar contracts
 */
export function usePolkadollarBackend() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getProvider = useCallback(() => {
    if (typeof window === 'undefined') return null;
    return new ethers.BrowserProvider((window as any).ethereum);
  }, []);

  const getSigner = useCallback(async () => {
    const provider = getProvider();
    if (!provider) throw new Error('No provider');
    return await provider.getSigner();
  }, [getProvider]);

  // ============ VAULT INTERACTIONS ============

  const depositCollateral = useCallback(
    async (amountDot: string) => {
      setLoading(true);
      setError(null);
      try {
        const signer = await getSigner();
        const vault = new ethers.Contract(
          publicRuntimeConfig.vaultAddress,
          [
            'function deposit() payable',
            'function getCollateral(address) view returns (uint256)',
          ],
          signer
        );

        const tx = await vault.deposit({
          value: ethers.parseEther(amountDot),
        });
        const receipt = await tx.wait();
        return { hash: tx.hash, receipt };
      } catch (err) {
        const message = (err as Error).message;
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [getSigner]
  );

  const getCollateral = useCallback(
    async (address: string) => {
      try {
        const provider = getProvider();
        if (!provider) throw new Error('No provider');

        const vault = new ethers.Contract(
          publicRuntimeConfig.vaultAddress,
          ['function getCollateral(address) view returns (uint256)'],
          provider
        );

        const amount = await vault.getCollateral(address);
        return ethers.formatEther(amount);
      } catch (err) {
        setError((err as Error).message);
        throw err;
      }
    },
    [getProvider]
  );

  // ============ PUSD INTERACTIONS ============

  const mintPusd = useCallback(
    async (amount: string) => {
      setLoading(true);
      setError(null);
      try {
        const signer = await getSigner();
        const vault = new ethers.Contract(
          publicRuntimeConfig.vaultAddress,
          ['function mint(uint256 amount)'],
          signer
        );

        const tx = await vault.mint(ethers.parseEther(amount));
        const receipt = await tx.wait();
        return { hash: tx.hash, receipt };
      } catch (err) {
        setError((err as Error).message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [getSigner]
  );

  const burnPusd = useCallback(
    async (amount: string) => {
      setLoading(true);
      setError(null);
      try {
        const signer = await getSigner();
        const vault = new ethers.Contract(
          publicRuntimeConfig.vaultAddress,
          ['function burn(uint256 amount)'],
          signer
        );

        const tx = await vault.burn(ethers.parseEther(amount));
        const receipt = await tx.wait();
        return { hash: tx.hash, receipt };
      } catch (err) {
        setError((err as Error).message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [getSigner]
  );

  const getPusdBalance = useCallback(
    async (address: string) => {
      try {
        const provider = getProvider();
        if (!provider) throw new Error('No provider');

        const pusd = new ethers.Contract(
          publicRuntimeConfig.pusdAddress,
          ['function balanceOf(address) view returns (uint256)'],
          provider
        );

        const balance = await pusd.balanceOf(address);
        return ethers.formatEther(balance);
      } catch (err) {
        setError((err as Error).message);
        throw err;
      }
    },
    [getProvider]
  );

  // ============ PRICE FEED ============

  const getCurrentPrice = useCallback(async () => {
    try {
      const provider = getProvider();
      if (!provider) throw new Error('No provider');

      const feed = new ethers.Contract(
        publicRuntimeConfig.priceFeedAddress,
        ['function getPrice() view returns (uint256)'],
        provider
      );

      const price = await feed.getPrice();
      return ethers.formatEther(price); // Convert from 18 decimals
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  }, [getProvider]);

  // ============ XCM OPERATIONS ============

  const sendXcmToHydration = useCallback(
    async (messageHex: string) => {
      setLoading(true);
      setError(null);
      try {
        const signer = await getSigner();
        const xcmInterface = new ethers.Interface([
          'function send(bytes dest, bytes message) returns (bool)',
        ]);

        const tx = await signer.sendTransaction({
          to: publicRuntimeConfig.xcmPrecompile,
          data: xcmInterface.encodeFunctionData('send', [
            publicRuntimeConfig.xcmDestHydration,
            messageHex,
          ]),
        });

        const receipt = await tx.wait();
        return { hash: tx.hash, receipt };
      } catch (err) {
        setError((err as Error).message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [getSigner]
  );

  // ============ UTILITY ============

  const switchNetwork = useCallback(async () => {
    if (!window.ethereum) throw new Error('No wallet');

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${publicRuntimeConfig.chainId.toString(16)}` }],
      });
    } catch (err: any) {
      if (err.code === 4902) {
        // Network not added, add it
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: `0x${publicRuntimeConfig.chainId.toString(16)}`,
              rpcUrls: [publicRuntimeConfig.rpcUrl],
              chainName: 'Paseo Asset Hub',
              nativeCurrency: { name: 'DOT', symbol: 'DOT', decimals: 18 },
            },
          ],
        });
      } else {
        throw err;
      }
    }
  }, []);

  return {
    // State
    loading,
    error,

    // Vault
    depositCollateral,
    getCollateral,

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
      vault: publicRuntimeConfig.vaultAddress,
      pusd: publicRuntimeConfig.pusdAddress,
      priceFeed: publicRuntimeConfig.priceFeedAddress,
      riskEngine: publicRuntimeConfig.riskEngineAddress,
      xcmPrecompile: publicRuntimeConfig.xcmPrecompile,
    },
  };
}
