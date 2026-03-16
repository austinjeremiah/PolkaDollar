import { ethers } from "hardhat";

const CANDIDATES = [
  "0x0000000000000000000000000000000000000803",
  "0x000000000000000000000000000000000000A000",
  "0x00000000000000000000000000000000000A0000",
];

const WEIGH_MESSAGE_SELECTOR = ethers.id("weighMessage(bytes)").slice(0, 10);
const WEIGH_EMPTY_BYTES_CALLDATA = WEIGH_MESSAGE_SELECTOR + ethers.AbiCoder.defaultAbiCoder().encode(["bytes"], ["0x"]).slice(2);

async function probeCall(to: string, data: string) {
  try {
    const result = await ethers.provider.call({ to, data });
    return { ok: true as const, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false as const, error: message };
  }
}

async function main() {
  console.log(`weighMessage(bytes) selector: ${WEIGH_MESSAGE_SELECTOR}`);

  for (const address of CANDIDATES) {
    console.log(`\nCandidate: ${address}`);

    const empty = await probeCall(address, "0x");
    if (empty.ok) {
      console.log(`  empty call      : OK  -> ${empty.result}`);
    } else {
      console.log(`  empty call      : REVERT -> ${empty.error}`);
    }

    const weigh = await probeCall(address, WEIGH_EMPTY_BYTES_CALLDATA);
    if (weigh.ok) {
      console.log(`  weighMessage([]): OK  -> ${weigh.result}`);
    } else {
      console.log(`  weighMessage([]): REVERT -> ${weigh.error}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
