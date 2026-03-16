import { ethers } from "hardhat";

/**
 * XCM Encoder for Asset Hub Paseo -> Hydration
 * Generates properly encoded dest and message bytes for XCMTransfer contract
 * 
 * Uses manual SCALE encoding for XCM structures
 */

// Hydration parachain ID on Paseo
const HYDRATION_PARA_ID = 3001;

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
 * Encode Parachain ID (u32)
 */
function encodeParachainId(id: number): Buffer {
  const buf = Buffer.allocUnsafe(4);
  buf.writeUInt32LE(id, 0);
  return buf;
}

/**
 * Create encoded destination bytes for Hydration
 * V4 MultiLocation: parents=1, interior=X1(Parachain(3001))
 */
function encodeDestination(): Buffer {
  const parts: Buffer[] = [];

  // Version tag for V4 (enum variant 4)
  parts.push(Buffer.from([4]));

  // parents: 1
  parts.push(Buffer.from([1]));

  // interior: X1 (enum variant 1 for 1 junction)
  parts.push(Buffer.from([1]));

  // Junction: Parachain(3001)
  // This is enum variant Parachain = 0
  parts.push(Buffer.from([0])); // Parachain variant
  parts.push(encodeParachainId(HYDRATION_PARA_ID));

  return Buffer.concat(parts);
}

/**
 * Create encoded message bytes - simplified XCM message
 * Using a minimal valid structure: WithdrawAsset -> BuyExecution -> Transact -> Deposit
 */
function encodeMessage(): Buffer {
  const parts: Buffer[] = [];

  // Version tag for V4
  parts.push(Buffer.from([4]));

  // Number of instructions (compacted)
  parts.push(encodeCompact(5n)); // 5 instructions

  // Instruction 1: WithdrawAsset
  parts.push(Buffer.from([0])); // WithdrawAsset variant
  parts.push(encodeCompact(1n)); // 1 asset
  // Asset location: (parents=0, interior=Here)
  parts.push(Buffer.from([0])); // parents
  parts.push(Buffer.from([0])); // interior: Here variant (no junctions)
  // Asset amount: Fungible(1000000)
  parts.push(Buffer.from([0])); // Fungible variant
  parts.push(encodeCompact(1000000n));

  // Instruction 2: BuyExecution
  parts.push(Buffer.from([1])); // BuyExecution variant
  // fees location: (parents=0, interior=Here)
  parts.push(Buffer.from([0])); // parents
  parts.push(Buffer.from([0])); // interior: Here
  // fee amount: Fungible(100000)
  parts.push(Buffer.from([0])); // Fungible
  parts.push(encodeCompact(100000n));
  // weight limit: Unlimited
  parts.push(Buffer.from([1])); // Unlimited variant

  // Instruction 3: Transact
  parts.push(Buffer.from([3])); // Transact variant
  // originKind: SovereignAccount = 1
  parts.push(Buffer.from([1]));
  // requireWeightAtMost: { refTime: 1000000000, proofSize: 65536 }
  parts.push(encodeCompact(1000000000n)); // refTime
  parts.push(encodeCompact(65536n)); // proofSize
  // call (encoded bytes): 0x01
  parts.push(encodeCompact(1n)); // 1 byte
  parts.push(Buffer.from([0x01]));

  // Instruction 4: RefundSurplus
  parts.push(Buffer.from([5])); // RefundSurplus variant

  // Instruction 5: DepositAsset
  parts.push(Buffer.from([11])); // DepositAsset variant
  // assets: Wild(All)
  parts.push(Buffer.from([2])); // Wild variant
  parts.push(Buffer.from([0])); // All variant
  // beneficiary: (parents=0, interior=X1(AccountId32))
  parts.push(Buffer.from([0])); // parents
  parts.push(Buffer.from([1])); // interior: X1
  parts.push(Buffer.from([3])); // AccountId32 junction variant
  parts.push(Buffer.from([0])); // network: None
  // account: 32 zero bytes
  parts.push(Buffer.alloc(32, 0));

  return Buffer.concat(parts);
}

async function main() {
  console.log("🚀 XCM Encoder for Asset Hub Paseo -> Hydration\n");

  try {
    const destHex = encodeDestination().toString("hex");
    const messageHex = encodeMessage().toString("hex");

    console.log("✅ Encoded Destination:");
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
