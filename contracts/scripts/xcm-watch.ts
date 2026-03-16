import { ApiPromise, WsProvider } from "@polkadot/api";
import { ethers } from "ethers";

const SOURCE_EVM_RPC = process.env.SOURCE_EVM_RPC || "https://eth-rpc-testnet.polkadot.io/";
const SOURCE_TX_HASH = process.env.SOURCE_TX_HASH;
const DESTINATION_WS = process.env.DESTINATION_WS || process.env.RELAY_WS;
const WINDOW_SECONDS = Number(process.env.WINDOW_SECONDS || "180");
const DESTINATION_SCAN_BLOCKS = Number(
  process.env.DESTINATION_SCAN_BLOCKS || process.env.RELAY_SCAN_BLOCKS || "300"
);

const INTERESTING_SECTIONS = new Set([
  "polkadotXcm",
  "xcmpQueue",
  "messageQueue",
  "dmpQueue",
]);

type DestinationHit = {
  blockNumber: number;
  timestampMs: bigint;
  section: string;
  method: string;
  data: string;
};

function short(value: string, limit = 180): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}...`;
}

async function getSourceTxContext() {
  if (!SOURCE_TX_HASH) {
    throw new Error("Missing SOURCE_TX_HASH env var");
  }

  const provider = new ethers.JsonRpcProvider(SOURCE_EVM_RPC);
  const tx = await provider.getTransaction(SOURCE_TX_HASH);
  const receipt = await provider.getTransactionReceipt(SOURCE_TX_HASH);

  if (!tx || !receipt || receipt.blockNumber == null) {
    throw new Error(`Source transaction not found: ${SOURCE_TX_HASH}`);
  }

  const block = await provider.getBlock(receipt.blockNumber);
  if (!block) {
    throw new Error(`Source block not found: ${receipt.blockNumber}`);
  }

  return {
    txHash: SOURCE_TX_HASH,
    blockNumber: receipt.blockNumber,
    blockTimestampMs: BigInt(block.timestamp) * 1000n,
    from: tx.from,
    to: tx.to,
    status: receipt.status,
    gasUsed: receipt.gasUsed.toString(),
  };
}

async function connectDestination(): Promise<ApiPromise> {
  if (!DESTINATION_WS) {
    throw new Error("Missing DESTINATION_WS or RELAY_WS env var (destination websocket endpoint)");
  }

  const provider = new WsProvider(DESTINATION_WS);
  return ApiPromise.create({ provider });
}

async function scanDestinationEvents(api: ApiPromise, sourceTimestampMs: bigint): Promise<DestinationHit[]> {
  const head = await api.rpc.chain.getFinalizedHead();
  const header = await api.rpc.chain.getHeader(head);
  const headNumber = header.number.toNumber();
  const fromBlock = Math.max(1, headNumber - DESTINATION_SCAN_BLOCKS);

  const hits: DestinationHit[] = [];

  for (let blockNumber = fromBlock; blockNumber <= headNumber; blockNumber++) {
    const hash = await api.rpc.chain.getBlockHash(blockNumber);

    const [events, tsNow] = await Promise.all([
      api.query.system.events.at(hash),
      api.query.timestamp.now.at(hash),
    ]);

    const tsMs = BigInt(tsNow.toString());
    const deltaSeconds = tsMs > sourceTimestampMs
      ? (tsMs - sourceTimestampMs) / 1000n
      : (sourceTimestampMs - tsMs) / 1000n;

    if (deltaSeconds > BigInt(WINDOW_SECONDS)) {
      continue;
    }

    for (const record of events) {
      const event = record.event;
      if (!INTERESTING_SECTIONS.has(event.section)) {
        continue;
      }

      hits.push({
        blockNumber,
        timestampMs: tsMs,
        section: event.section,
        method: event.method,
        data: short(event.data.toString()),
      });
    }
  }

  return hits;
}

async function main() {
  console.log("== XCM Watcher ==");
  console.log(`Source RPC         : ${SOURCE_EVM_RPC}`);
  console.log(`Destination WS     : ${DESTINATION_WS || "(missing)"}`);
  console.log(`Window             : +/- ${WINDOW_SECONDS}s`);
  console.log(`Destination scan   : last ${DESTINATION_SCAN_BLOCKS} blocks`);

  const source = await getSourceTxContext();

  console.log("\n-- Source Tx --");
  console.log(`Hash               : ${source.txHash}`);
  console.log(`Block              : ${source.blockNumber}`);
  console.log(`Timestamp (ms)     : ${source.blockTimestampMs}`);
  console.log(`From               : ${source.from}`);
  console.log(`To                 : ${source.to}`);
  console.log(`Status             : ${source.status}`);
  console.log(`Gas Used           : ${source.gasUsed}`);

  const api = await connectDestination();

  try {
    const chain = (await api.rpc.system.chain()).toString();
    const node = (await api.rpc.system.name()).toString();
    const version = (await api.rpc.system.version()).toString();

    console.log("\n-- Destination Endpoint --");
    console.log(`Chain              : ${chain}`);
    console.log(`Node               : ${node} ${version}`);

    const hits = await scanDestinationEvents(api, source.blockTimestampMs);

    console.log("\n-- Matching XCM Events --");
    if (hits.length === 0) {
      console.log("No matching XCM-related events found in the selected window.");
      console.log("Try increasing WINDOW_SECONDS or DESTINATION_SCAN_BLOCKS.");
      return;
    }

    for (const hit of hits) {
      console.log(
        `block=${hit.blockNumber} section=${hit.section} method=${hit.method} ts=${hit.timestampMs} data=${hit.data}`
      );
    }
  } finally {
    await api.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
