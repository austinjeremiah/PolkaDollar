import { ethers } from "hardhat";
import {
  encodeDestinationHex,
  encodeMessageHex,
  parseBeneficiaryAccountId32,
  XcmTarget,
} from "./xcm-utils";

/**
 * Send XCM directly through the precompile
 * Bypasses the contract wrapper
 */

const TARGET = ((process.env.XCM_DEST_TARGET || "relay").toLowerCase() as XcmTarget);
const HYDRATION_PARA_ID = Number(process.env.HYDRATION_PARA_ID || "2034");
const AMOUNT_PLANCK = BigInt(process.env.XCM_AMOUNT_PLANCK || "1000000");
const EXECUTION_FEE_PLANCK = BigInt(process.env.XCM_FEE_PLANCK || "100000");

const RAW_DEST = process.env.DEST_HEX;
const RAW_MESSAGE = process.env.MESSAGE_HEX;

const BENEFICIARY_RAW =
  process.env.XCM_BENEFICIARY ||
  process.env.HYDRATION_BENEFICIARY ||
  process.env.RELAY_BENEFICIARY_ACCOUNT_ID32;

// The working precompile on Asset Hub Paseo
const XCM_PRECOMPILE = "0x000000000000000000000000000000000000A000";

// IXcm interface - just the send method
const IXcm = [
  {
    type: "function",
    name: "send",
    inputs: [
      { name: "dest", type: "bytes" },
      { name: "message", type: "bytes" },
    ],
    outputs: [{ type: "bool" }],
  },
];

async function main() {
  console.log("🚀 Sending XCM Directly Through Precompile\n");

  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}\n`);

  let destHex = RAW_DEST;
  let messageHex = RAW_MESSAGE;

  if (!destHex || !messageHex) {
    if (TARGET !== "relay" && TARGET !== "hydration") {
      throw new Error(`Unsupported XCM_DEST_TARGET: ${TARGET}`);
    }
    if (!BENEFICIARY_RAW) {
      throw new Error(
        "Missing beneficiary. Set XCM_BENEFICIARY (ss58 or 0x32-byte AccountId32), or pass raw DEST_HEX + MESSAGE_HEX."
      );
    }

    const beneficiaryAccountId32 = await parseBeneficiaryAccountId32(BENEFICIARY_RAW);
    destHex = encodeDestinationHex(TARGET, HYDRATION_PARA_ID);
    messageHex = encodeMessageHex({
      target: TARGET,
      hydrationParaId: HYDRATION_PARA_ID,
      beneficiaryAccountId32,
      amountPlanck: AMOUNT_PLANCK,
      executionFeePlanck: EXECUTION_FEE_PLANCK,
    });
  }

  if (!destHex || !messageHex) {
    throw new Error("Unable to build destination/message payload");
  }

  // Get XCM precompile interface
  console.log(`⏳ Connecting to XCM precompile at ${XCM_PRECOMPILE}...`);
  const xcmPrecompile = new ethers.Contract(XCM_PRECOMPILE, IXcm, signer);
  console.log("✅ Connected\n");

  // Show parameters
  console.log(`🎯 Target: ${TARGET}`);
  if (TARGET === "hydration") {
    console.log(`🏝️  Hydration paraId: ${HYDRATION_PARA_ID}`);
  }
  console.log("📤 XCM Message Parameters:");
  console.log(`   Destination: ${destHex}`);
  console.log(`   Message:     ${messageHex.slice(0, 60)}...`);
  console.log(`   Message len: ${(messageHex.length / 2 - 1)} bytes`);
  console.log(`   Precompile:  ${XCM_PRECOMPILE}\n`);

  try {
    // Estimate gas for the call
    console.log("⏳ Estimating gas...");
    const gasEstimate = await ethers.provider.estimateGas({
      to: XCM_PRECOMPILE,
      data: xcmPrecompile.interface.encodeFunctionData("send", [
        destHex,
        messageHex,
      ]),
    });
    console.log(`✅ Gas estimate: ${gasEstimate.toString()}\n`);

    // Call the precompile
    console.log("⏳ Sending XCM through precompile...");
    const tx = await xcmPrecompile.send(destHex, messageHex, {
      gasLimit: gasEstimate * 2n,
    });

    console.log(`📨 Transaction hash: ${tx.hash}`);
    console.log("⏳ Waiting for confirmation...\n");

    const receipt = await tx.wait();

    if (receipt?.status === 1) {
      console.log("✅ XCM Message Sent Successfully!\n");
      console.log("📊 Transaction Details:");
      console.log(`   Hash:     ${receipt.hash}`);
      console.log(`   Block:    ${receipt.blockNumber}`);
      console.log(`   Gas used: ${receipt.gasUsed}`);
      console.log(`   From:     ${receipt.from}`);

      console.log(`\n✅ XCM sent to precompile - message routed toward ${TARGET} destination.`);
    } else {
      console.log("⚠️  Transaction included but reverted");
    }
  } catch (error) {
    console.error("❌ Error:", (error as any)?.message || String(error));
    if ((error as any)?.reason) {
      console.error("   Reason:", (error as any).reason);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
