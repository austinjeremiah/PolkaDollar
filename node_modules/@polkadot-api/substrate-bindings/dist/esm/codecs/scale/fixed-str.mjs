import { enhanceCodec, Bytes } from 'scale-ts';

const textEncoder$2 = new TextEncoder();
const textDecoder$1 = new TextDecoder();
const fixedStr = (nBytes) => enhanceCodec(
  Bytes(nBytes),
  (str) => textEncoder$2.encode(str),
  (bytes) => textDecoder$1.decode(bytes)
);

export { fixedStr, textEncoder$2 as textEncoder };
//# sourceMappingURL=fixed-str.mjs.map
