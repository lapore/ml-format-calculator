import type { FormatId } from "../constants/format-id.js";
import type { RoundingMode } from "../constants/rounding.js";
import type { EncodedValue } from "../model/encoded-value.js";
import { getFormatDefinition } from "../formats/index.js";
import { encodeFloat } from "./encode-float.js";
import { encodeInt } from "./encode-int.js";

export function encodeValue(
  formatId: FormatId,
  value: number,
  roundingMode: RoundingMode,
): EncodedValue {
  const format = getFormatDefinition(formatId);

  if (format.kind === "integer") {
    return encodeInt(format, value, roundingMode);
  }

  if (format.exponentBias === null) {
    throw new Error(`${format.id}: encode not implemented until exact format convention is defined`);
  }

  return encodeFloat(format, value, roundingMode);
}
