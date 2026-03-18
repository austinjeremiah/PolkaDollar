import { decodeAddress, cryptoWaitReady } from "@polkadot/util-crypto";

export type BuildXcmMessageParams = {
  amountPlanck: bigint;
  executionFeePlanck: bigint;
  beneficiaryAccountId32: string;
};

export type XcmDestinationTarget =
  | { type: "relay" }
  | { type: "parachain"; paraId: number };

const COMPACT_SMALL = BigInt(64);
const COMPACT_MEDIUM = BigInt(16384);
const ONE = BigInt(1);
const THREE = BigInt(3);

function encodeCompact(value: bigint): Uint8Array {
  if (value < COMPACT_SMALL) {
    return Uint8Array.from([(Number(value) << 2) | 0]);
  }

  if (value < COMPACT_MEDIUM) {
    const encoded = (Number(value) << 2) | 1;
    return Uint8Array.from([encoded & 0xff, (encoded >> 8) & 0xff]);
  }

  const encoded = (Number(value) << 2) | 2;
  return Uint8Array.from([
    encoded & 0xff,
    (encoded >> 8) & 0xff,
    (encoded >> 16) & 0xff,
    (encoded >> 24) & 0xff,
  ]);
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function bytesToHex(data: Uint8Array): string {
  return `0x${Array.from(data)
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

function encodeU32LE(value: number): Uint8Array {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error(`Invalid paraId: ${value}`);
  }

  return Uint8Array.from([
    value & 0xff,
    (value >> 8) & 0xff,
    (value >> 16) & 0xff,
    (value >> 24) & 0xff,
  ]);
}

export function buildXcmDestinationHex(target: XcmDestinationTarget): string {
  if (target.type === "relay") {
    // V4 MultiLocation: parents=1, interior=Here
    return bytesToHex(Uint8Array.from([4, 1, 0]));
  }

  // V4 MultiLocation: parents=1, interior=X1(Parachain(paraId))
  return bytesToHex(
    concatBytes([
      Uint8Array.from([4, 1, 1, 0]),
      encodeU32LE(target.paraId),
    ])
  );
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (normalized.length % 2 !== 0) {
    throw new Error("Invalid hex length");
  }
  const out = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export async function parseAccountId32(input: string): Promise<string> {
  const value = input.trim();

  if (/^0x[0-9a-fA-F]{64}$/.test(value)) {
    return value.toLowerCase();
  }

  if (!value) {
    throw new Error("Recipient is required");
  }

  await cryptoWaitReady();
  const decoded = decodeAddress(value);
  if (decoded.length !== 32) {
    throw new Error("Recipient must resolve to AccountId32");
  }

  return bytesToHex(decoded);
}

export function buildXcmMessageHex(params: BuildXcmMessageParams): string {
  const beneficiary = params.beneficiaryAccountId32.trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(beneficiary)) {
    throw new Error("Beneficiary must be 32-byte hex (0x + 64 chars)");
  }

  const bytes = concatBytes([
    Uint8Array.from([4]), // V4
    encodeCompact(THREE), // 3 instructions

    // WithdrawAsset
    Uint8Array.from([0]),
    encodeCompact(ONE),
    Uint8Array.from([0, 0]),
    Uint8Array.from([0]),
    encodeCompact(params.amountPlanck),

    // BuyExecution
    Uint8Array.from([1]),
    Uint8Array.from([0, 0]),
    Uint8Array.from([0]),
    encodeCompact(params.executionFeePlanck),
    Uint8Array.from([1]), // Unlimited

    // DepositAsset
    Uint8Array.from([11]),
    Uint8Array.from([2, 0]), // Wild(All)
    Uint8Array.from([0, 1, 3, 0]), // parents=0, X1(AccountId32), network=None
    hexToBytes(beneficiary),
  ]);

  return bytesToHex(bytes);
}
