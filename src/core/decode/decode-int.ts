import type { FormatDefinition } from "../model/format-definition.js";
import type { DecodedValue } from "../model/decoded-value.js";
import { formatBinary, formatHex, maskForWidth } from "../utils/bits.js";

export function decodeInt(
  format: FormatDefinition,
  rawBits: bigint,
): DecodedValue {
  if (format.kind !== "integer") {
    throw new Error(`${format.id}: non-integer formats must not use decodeInt`);
  }

  const widthMask = maskForWidth(format.bitWidth);
  if (rawBits < 0 || rawBits > widthMask) {
    throw new Error(`${format.id}: raw bits out of range for ${format.bitWidth}-bit format`);
  }

  const signBitMask = 1n << BigInt(format.bitWidth - 1);
  const isNegative = (rawBits & signBitMask) !== 0n;
  const signedValue = isNegative ? rawBits - (1n << BigInt(format.bitWidth)) : rawBits;

  let sign: "POS" | "NEG" | "NONE" = "NONE";
  if (signedValue > 0n) {
    sign = "POS";
  } else if (signedValue < 0n) {
    sign = "NEG";
  }

  return {
    formatId: format.id,
    rawBits,
    rawBinary: formatBinary(rawBits, format.bitWidth),
    rawHex: formatHex(rawBits, format.bitWidth),
    classification: signedValue === 0n ? "ZERO" : "INTEGER",
    sign,
    signBit: String(isNegative ? 1 : 0),
    exponentBits: null,
    mantissaBits: null,
    exponentBias: null,
    storedBiasedExponent: null,
    actualExponent: null,
    decimalValue: Number(signedValue),
    decimalValueText: signedValue.toString(),
    isZero: signedValue === 0n,
    isSubnormal: false,
    isNormal: false,
    isInfinity: false,
    isNaN: false,
    nanKind: null,
  };
}
