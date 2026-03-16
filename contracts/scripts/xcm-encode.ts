import { ApiPromise, WsProvider } from "@polkadot/api";

/**
 * XCM Encoder for Asset Hub Paseo -> Paseo Relay Chain
 * Generates properly encoded dest and message bytes for XCMTransfer contract
 * 
 * Uses manual SCALE encoding for XCM structures
 */

const ASSET_HUB_PASEO_WS = process.env.ASSET_HUB_PASEO_WS || "wss://asset-hub-paseo-rpc.n.dwellir.com";
const RELAY_BENEFICIARY_ACCOUNT_ID32 =
  process.env.RELAY_BENEFICIARY_ACCOUNT_ID32 ||
  "0x0000000000000000000000000000000000000000000000000000000000000000";
const TELEPORT_AMOUNT = BigInt(process.env.XCM_AMOUNT_PLANCK || "1000000");
const EXECUTION_FEE = BigInt(process.env.XCM_FEE_PLANCK || "100000");

/**
 * Encode a compact number in SCALE format
 * For numbers < 2^30, use: (n << 2) | 0
 */
function encodeCompact(value: bigint): Buffer {
  if (value < 64n) {
    return Buffer.from([(Number(value) << 2) | 0]);
  } else if (value < 16384n) {
    const encoded = (Number(value) << 2) | 1;
    return Buffer.from([encoded & 0xff, (encoded >> 8) & 0xff]);
  } else {
    // For larger values, use 4-byte compact
    const encoded = (Number(value) << 2) | 2;
    return Buffer.from([
      encoded & 0xff,
      (encoded >> 8) & 0xff,
      (encoded >> 16) & 0xff,
      (encoded >> 24) & 0xff,
    ]);
  }
}

/**
 * Create encoded destination bytes for Relay Chain
 * V4 MultiLocation: parents=1, interior=Here
 * Expected bytes: 0x040100
 */
function encodeDestination(): Buffer {
  const parts: Buffer[] = [];

  // Version tag: V4
  parts.push(Buffer.from([4]));
  // parents = 1 (go to parent relay chain)
  parts.push(Buffer.from([1]));
  // interior = Here
  parts.push(Buffer.from([0]));

  return Buffer.concat(parts);
}

/**
 * Create encoded message bytes for teleport-like flow
 * Instructions: WithdrawAsset -> BuyExecution -> DepositAsset
 */
function encodeMessage(): Buffer {
  const parts: Buffer[] = [];

  // Version tag for V4
  parts.push(Buffer.from([4]));

  // Number of instructions (compacted)
  parts.push(encodeCompact(3n)); // 3 instructions

  // Instruction 1: WithdrawAsset
  parts.push(Buffer.from([0])); // WithdrawAsset variant
  parts.push(encodeCompact(1n)); // 1 asset
  // Asset location: (parents=0, interior=Here)
  parts.push(Buffer.from([0])); // parents
  parts.push(Buffer.from([0])); // interior: Here variant (no junctions)
  // Asset amount
  parts.push(Buffer.from([0])); // Fungible variant
  parts.push(encodeCompact(TELEPORT_AMOUNT));

  // Instruction 2: BuyExecution
  parts.push(Buffer.from([1])); // BuyExecution variant
  // fees location: (parents=0, interior=Here)
  parts.push(Buffer.from([0])); // parents
  parts.push(Buffer.from([0])); // interior: Here
  // fee amount
  parts.push(Buffer.from([0])); // Fungible
  parts.push(encodeCompact(EXECUTION_FEE));
  // weight limit: Unlimited
  parts.push(Buffer.from([1])); // Unlimited variant

  // Instruction 3: DepositAsset
  parts.push(Buffer.from([11])); // DepositAsset variant
  // assets: Wild(All)
  parts.push(Buffer.from([2])); // Wild variant
  parts.push(Buffer.from([0])); // All variant
  // beneficiary: (parents=0, interior=X1(AccountId32))
  parts.push(Buffer.from([0])); // parents
  parts.push(Buffer.from([1])); // interior: X1
  parts.push(Buffer.from([3])); // AccountId32 junction variant
  parts.push(Buffer.from([0])); // network: None
  // relay-chain beneficiary account id32
  parts.push(Buffer.from(RELAY_BENEFICIARY_ACCOUNT_ID32.slice(2), "hex"));

  return Buffer.concat(parts);
}

async function printTeleportExtrinsicPreview() {
  try {
    const provider = new WsProvider(ASSET_HUB_PASEO_WS);
    const api = await ApiPromise.create({ provider });

    const destination = {
      V4: {
        parents: 1,
        interior: "Here",
      },
    };

    const beneficiary = {
      V4: {
        parents: 0,
        interior: {
          X1: [
            {
              AccountId32: {
                network: null,
                id: RELAY_BENEFICIARY_ACCOUNT_ID32,
              },
            },
          ],
        },
      },
    };

    const assets = {
      V4: [
        {
          id: {
            Concrete: {
              parents: 0,
              interior: "Here",
            },
          },
          fun: {
            Fungible: TELEPORT_AMOUNT,
          },
        },
      ],
    };

    const tx = api.tx.polkadotXcm.limitedTeleportAssets(
      destination,
      beneficiary,
      assets,
      0,
      "Unlimited"
    );

    console.log("\n📦 limitedTeleportAssets() call hex preview:");
    console.log(tx.method.toHex());

    await api.disconnect();
  } catch (error) {
    console.log("\n⚠️ Could not build limitedTeleportAssets preview from WS metadata:");
    console.log((error as Error).message);
  }
}

async function main() {
  console.log("🚀 XCM Encoder for Asset Hub Paseo -> Relay Chain\n");

  try {
    const destHex = encodeDestination().toString("hex");
    const messageHex = encodeMessage().toString("hex");

    console.log("✅ Encoded Destination (Relay Chain):");
    console.log(`0x${destHex}`);
    console.log(`   (${destHex.length / 2} bytes)\n`);

    console.log("✅ Encoded Message:");
    console.log(`0x${messageHex}`);
    console.log(`   (${messageHex.length / 2} bytes)\n`);

    // Output contract call format
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔗 XCMTransfer Contract Call Parameters:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log(`Function: sendXcm(bytes dest, bytes message)\n`);
    console.log(`dest = "0x${destHex}"`);
    console.log(`\nmessage = "0x${messageHex}"`);

    // Example contract call
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📝 Example Hardhat/Ethers Usage:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log(`const [signer] = await ethers.getSigners();
const xcmTransfer = await ethers.getContractAt(
  "XCMTransfer",
  "0x{deployed_contract_address}",
  signer
);

const tx = await xcmTransfer.sendXcm(
  "0x${destHex}",
  "0x${messageHex}",
  { 
    gasLimit: 5_000_000,
    gasPrice: ethers.parseUnits("50", "gwei")
  }
);

const receipt = await tx.wait();
console.log("XCM sent:", receipt?.hash);`);

    await printTeleportExtrinsicPreview();

    console.log("\n✅ Done! Copy the hex values above into your contract call.\n");
  } catch (error) {
    console.error("❌ Encoding failed:", (error as any)?.message || String(error));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
