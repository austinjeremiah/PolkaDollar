import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Demo 03 — EVM Solidity calls Rust PVM
 *
 * FibCaller.sol is a plain EVM Solidity contract — compiled with standard
 * solc. The Rust Fibonacci contract is compiled separately via cargo and
 * deployed as raw bytecode. No resolc plugin needed.
 */
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },

  networks: {
    hardhat: {},

    hub: {
      url: process.env.HUB_RPC_URL || "https://eth-rpc-testnet.polkadot.io/",
      chainId: 420420417,
      accounts: process.env.PRIVATE_KEY ? [`0x${process.env.PRIVATE_KEY}`] : [],
    },
  },
};

export default config;
