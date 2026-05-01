import type { BitSliceRequest } from "../model/bit-slice-request.js";
import type { BitSliceResponse } from "../model/bit-slice-response.js";
import { parseLooseBinaryInput } from "../parse/parse-binary-loose.js";
import { parseLooseHexInput } from "../parse/parse-hex-loose.js";
import { formatBinary, formatHex, maskForWidth } from "../utils/bits.js";

function validateBitIndex(name: string, value: number) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
}

export function extractBitSlice(request: BitSliceRequest): BitSliceResponse {
  validateBitIndex("minBit", request.minBit);
  validateBitIndex("maxBit", request.maxBit);

  if (request.maxBit < request.minBit) {
    throw new Error("maxBit must be greater than or equal to minBit");
  }

  const parsed = request.inputMode === "binary"
    ? parseLooseBinaryInput(request.inputValue)
    : parseLooseHexInput(request.inputValue);
  const sliceBitWidth = request.maxBit - request.minBit + 1;
  const sliceBits =
    (parsed.bits >> BigInt(request.minBit)) & maskForWidth(sliceBitWidth);
  const highestPresentBit = parsed.width - 1;
  const highestIncludedPresentBit = Math.min(request.maxBit, highestPresentBit);
  const presentBitCount = highestIncludedPresentBit >= request.minBit
    ? highestIncludedPresentBit - request.minBit + 1
    : 0;
  const zeroPadBitCount = sliceBitWidth - presentBitCount;

  return {
    inputMode: request.inputMode,
    inputBitWidth: parsed.width,
    normalizedInputBinary: formatBinary(parsed.bits, parsed.width),
    normalizedInputHex: formatHex(parsed.bits, parsed.width),
    minBit: request.minBit,
    maxBit: request.maxBit,
    sliceBitWidth,
    sliceBinary: formatBinary(sliceBits, sliceBitWidth),
    sliceHex: formatHex(sliceBits, sliceBitWidth),
    sliceDecimal: sliceBits.toString(10),
    rangeLabel: `[${request.maxBit}:${request.minBit}]`,
    zeroPadBitCount,
  };
}
