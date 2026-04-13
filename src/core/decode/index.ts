import type { FormatId } from "../constants/format-id.js";
import type { DecodedValue } from "../model/decoded-value.js";
import type { FormatDefinition } from "../model/format-definition.js";
import { getFormatDefinition } from "../formats/index.js";
import { decodeFloat } from "./decode-float.js";
import { decodeInt } from "./decode-int.js";

export function decodeBitsForFormat(format: FormatDefinition, rawBits: bigint): DecodedValue {
  if (format.kind === "integer") {
    return decodeInt(format, rawBits);
  }

  if (format.exponentBias === null) {
    throw new Error(`${format.id}: decode not implemented until exact format convention is defined`);
  }

  return decodeFloat(format, rawBits);
}

export function decodeRawBits(formatId: FormatId, rawBits: bigint): DecodedValue {
  const format = getFormatDefinition(formatId);
  return decodeBitsForFormat(format, rawBits);
}
