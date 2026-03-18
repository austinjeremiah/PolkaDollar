import { ApiPromise, WsProvider } from "@polkadot/api";
import {
  encodeDestinationHex,
  encodeMessageHex,
  parseBeneficiaryAccountId32,
  XcmTarget,
} from "./xcm-utils";

/**
 * XCM Encoder for Asset Hub Paseo -> Paseo Relay Chain
 * Generates properly encoded dest and message bytes for XCMTransfer contract
 * 
 * Uses manual SCALE encoding for XCM structures
 */

const ASSET_HUB_PASEO_WS = process.env.ASSET_HUB_PASEO_WS || "wss://asset-hub-paseo-rpc.n.dwellir.com";
const TARGET = ((process.env.XCM_DEST_TARGET || "relay").toLowerCase() as XcmTarget);
const HYDRATION_PARA_ID = Number(process.env.HYDRATION_PARA_ID || "2034");
const TELEPORT_AMOUNT = BigInt(process.env.XCM_AMOUNT_PLANCK || "1000000");
const EXECUTION_FEE = BigInt(process.env.XCM_FEE_PLANCK || "100000");

const BENEFICIARY_RAW =
  process.env.XCM_BENEFICIARY ||
  process.env.HYDRATION_BENEFICIARY ||
  process.env.RELAY_BENEFICIARY_ACCOUNT_ID32;

async function printTeleportExtrinsicPreview(beneficiaryAccountId32: string) {
  try {
    const provider = new WsProvider(ASSET_HUB_PASEO_WS);
    const api = await ApiPromise.create({ provider });

    const destination = TARGET === "relay"
      ? {
          V4: {
            parents: 1,
            interior: "Here",
          },
        }
      : {
          V4: {
            parents: 1,
            interior: {
              X1: [{ Parachain: HYDRATION_PARA_ID }],
            },
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
                id: beneficiaryAccountId32,
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
  console.log("🚀 XCM Encoder for Asset Hub Paseo\n");

  try {
    if (TARGET !== "relay" && TARGET !== "hydration") {
      throw new Error(`Unsupported XCM_DEST_TARGET: ${TARGET}`);
    }
    if (!BENEFICIARY_RAW) {
      throw new Error(
        "Missing beneficiary. Set XCM_BENEFICIARY (ss58 or 0x32-byte AccountId32)."
      );
    }

    const beneficiaryAccountId32 = await parseBeneficiaryAccountId32(BENEFICIARY_RAW);
    const destHex = encodeDestinationHex(TARGET, HYDRATION_PARA_ID);
    const messageHex = encodeMessageHex({
      target: TARGET,
      hydrationParaId: HYDRATION_PARA_ID,
      beneficiaryAccountId32,
      amountPlanck: TELEPORT_AMOUNT,
      executionFeePlanck: EXECUTION_FEE,
    });

    console.log(`Target: ${TARGET}`);
    if (TARGET === "hydration") {
      console.log(`Hydration paraId: ${HYDRATION_PARA_ID}`);
    }
    console.log(`Beneficiary AccountId32: ${beneficiaryAccountId32}`);
    console.log(`Amount (planck): ${TELEPORT_AMOUNT.toString()}`);
    console.log(`Fee (planck): ${EXECUTION_FEE.toString()}\n`);

    console.log("✅ Encoded Destination:");
    console.log(destHex);
    console.log(`   (${(destHex.length - 2) / 2} bytes)\n`);

    console.log("✅ Encoded Message:");
    console.log(messageHex);
    console.log(`   (${(messageHex.length - 2) / 2} bytes)\n`);

    // Output contract call format
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔗 XCMTransfer Contract Call Parameters:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log(`Function: sendCrossChain(bytes dest, bytes message)\n`);
    console.log(`dest = "${destHex}"`);
    console.log(`\nmessage = "${messageHex}"`);

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

const tx = await xcmTransfer.sendCrossChain(
  "${destHex}",
  "${messageHex}",
  { 
    gasLimit: 5_000_000,
    gasPrice: ethers.parseUnits("50", "gwei")
  }
);

const receipt = await tx.wait();
console.log("XCM sent:", receipt?.hash);`);

    await printTeleportExtrinsicPreview(beneficiaryAccountId32);

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
