import { decodeAddress, cryptoWaitReady } from "@polkadot/util-crypto";

export type XcmTarget = "relay" | "hydration";

export type XcmPayloadParams = {
  target: XcmTarget;
  hydrationParaId: number;
  beneficiaryAccountId32: string;
  amountPlanck: bigint;
  executionFeePlanck: bigint;
};

function encodeCompact(value: bigint): Buffer {
  if (value < 64n) {
    return Buffer.from([(Number(value) << 2) | 0]);
  }

  if (value < 16384n) {
    const encoded = (Number(value) << 2) | 1;
    return Buffer.from([encoded & 0xff, (encoded >> 8) & 0xff]);
  }

  const encoded = (Number(value) << 2) | 2;
  return Buffer.from([
    encoded & 0xff,
    (encoded >> 8) & 0xff,
    (encoded >> 16) & 0xff,
    (encoded >> 24) & 0xff,
  ]);
}

function encodeU32LE(value: number): Buffer {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error(`Invalid u32 value: ${value}`);
  }

  const out = Buffer.alloc(4);
  out.writeUInt32LE(value, 0);
  return out;
}

function toAccountId32Hex(raw: Uint8Array): string {
  if (raw.length !== 32) {
    throw new Error(`Beneficiary must decode to 32 bytes, got ${raw.length}`);
  }

  return `0x${Buffer.from(raw).toString("hex")}`;
}

function normalizeHex32(value: string): string {
  const v = value.trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(v)) {
    throw new Error("Beneficiary AccountId32 hex must be 32 bytes (0x + 64 hex chars)");
  }
  return v.toLowerCase();
}

export async function parseBeneficiaryAccountId32(input: string): Promise<string> {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Missing beneficiary account");
  }

  if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) {
    return normalizeHex32(trimmed);
  }

  await cryptoWaitReady();
  const decoded = decodeAddress(trimmed);
  return toAccountId32Hex(decoded);
}

export function encodeDestinationHex(target: XcmTarget, hydrationParaId: number): string {
  const parts: Buffer[] = [];
  parts.push(Buffer.from([4])); // XCM V4
  parts.push(Buffer.from([1])); // parents=1 (up to relay)

  if (target === "relay") {
    parts.push(Buffer.from([0])); // interior=Here
    return `0x${Buffer.concat(parts).toString("hex")}`;
  }

  // interior=X1(Parachain(paraId))
  parts.push(Buffer.from([1])); // interior has one junction
  parts.push(Buffer.from([0])); // Junction::Parachain
  parts.push(encodeU32LE(hydrationParaId));
  return `0x${Buffer.concat(parts).toString("hex")}`;
}

export function encodeMessageHex(params: XcmPayloadParams): string {
  const parts: Buffer[] = [];

  parts.push(Buffer.from([4])); // XCM V4
  parts.push(encodeCompact(3n)); // 3 instructions

  // WithdrawAsset([Here, Fungible(amount)])
  parts.push(Buffer.from([0]));
  parts.push(encodeCompact(1n));
  parts.push(Buffer.from([0]));
  parts.push(Buffer.from([0]));
  parts.push(Buffer.from([0]));
  parts.push(encodeCompact(params.amountPlanck));

  // BuyExecution(fees=Here/Fungible(fee), weight=Unlimited)
  parts.push(Buffer.from([1]));
  parts.push(Buffer.from([0]));
  parts.push(Buffer.from([0]));
  parts.push(Buffer.from([0]));
  parts.push(encodeCompact(params.executionFeePlanck));
  parts.push(Buffer.from([1]));

  // DepositAsset(Wild(All), beneficiary=X1(AccountId32))
  parts.push(Buffer.from([11]));
  parts.push(Buffer.from([2]));
  parts.push(Buffer.from([0]));
  parts.push(Buffer.from([0]));
  parts.push(Buffer.from([1]));
  parts.push(Buffer.from([3]));
  parts.push(Buffer.from([0]));
  parts.push(Buffer.from(params.beneficiaryAccountId32.slice(2), "hex"));

  return `0x${Buffer.concat(parts).toString("hex")}`;
}