import { enhanceCodec, Bytes, _void } from 'scale-ts';
import '../utils/ss58-util.mjs';
import './scale/Binary.mjs';
import './scale/bitSequence.mjs';
import './scale/char.mjs';
import { compactNumber } from './scale/compact.mjs';
import { Hex } from './scale/Hex.mjs';
import './scale/fixed-str.mjs';
import { Variant } from './scale/Variant.mjs';
import './scale/ethAccount.mjs';
import { Struct, Vector } from './scale/shaped.mjs';
import './scale/BitSeq.mjs';

const textEncoder$1 = new TextEncoder();
const textDecoder = new TextDecoder();
const fourChars = enhanceCodec(
  Bytes(4),
  textEncoder$1.encode.bind(textEncoder$1),
  textDecoder.decode.bind(textDecoder)
);
const diggestVal = Struct({
  engine: fourChars,
  payload: Hex()
});
const diggest = Variant(
  {
    other: Bytes(),
    consensus: diggestVal,
    seal: diggestVal,
    preRuntime: diggestVal,
    runtimeUpdated: _void
  },
  [0, 4, 5, 6, 8]
);
const hex32$1 = Hex(32);
const blockHeader = Struct({
  parentHash: hex32$1,
  number: compactNumber,
  stateRoot: hex32$1,
  extrinsicRoot: hex32$1,
  digests: Vector(diggest)
});

export { blockHeader };
//# sourceMappingURL=blockHeader.mjs.map
