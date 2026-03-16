import { defineConfig } from 'next/config'

/**
 * Polkadollar Frontend Configuration
 * Connects to fully deployed backend on Paseo Asset Hub
 */

const publicRuntimeConfig = {
  // Contract Addresses
  vaultAddress: process.env.NEXT_PUBLIC_VAULT_ADDRESS || '0x54Dc42542E36F10b5Ff8B60A00cf1e48278006ae',
  pusdAddress: process.env.NEXT_PUBLIC_PUSD_ADDRESS || '0x876df4BBD21ec38f78D6AEbF9687a89445821BE7',
  priceFeedAddress: process.env.NEXT_PUBLIC_PRICE_FEED_ADDRESS || '0xCDe170C92E281757aD961Ba47B33DFacd827a761',
  riskEngineAddress: process.env.NEXT_PUBLIC_RISK_ENGINE_ADDRESS || '0x1a5b66d8b4170213696D7a0Ec465fFF165E6ba2B',
  
  // XCM Configuration
  xcmPrecompile: process.env.NEXT_PUBLIC_XCM_PRECOMPILE || '0x000000000000000000000000000000000000A000',
  xcmDestHydration: process.env.NEXT_PUBLIC_XCM_DEST_HYDRATION || '0x04010100b90b0000',
  
  // Network
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'https://eth-rpc-testnet.polkadot.io/',
  chainId: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '1287'),
};

export default defineConfig({
  publicRuntimeConfig,
  reactStrictMode: true,
  swcMinify: true,
});
