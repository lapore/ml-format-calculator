import type { RoundingMode } from "../constants/rounding.js";
import type { EncodedValue } from "../model/encoded-value.js";
import type { FormatDefinition } from "../model/format-definition.js";
import { formatBinary, formatHex } from "../utils/bits.js";
import { numberToFloat32Bits } from "./float32-bits.js";

function encodeFloat32(value: number, roundingMode: RoundingMode): EncodedValue {
  const rawBits = BigInt(numberToFloat32Bits(value));
  return {
    formatId: "FP32",
    inputValue: value,
    roundingMode,
    rawBits,
    rawBinary: formatBinary(rawBits, 32),
    rawHex: formatHex(rawBits, 32),
    notes: [],
  };
}

function roundMantissa(
  mantissa: number,
  shift: number,
  roundingMode: RoundingMode,
): { mantissa: number; carry: boolean } {
  if (shift <= 0) {
    return { mantissa, carry: false };
  }

  const truncated = mantissa >> shift;
  const remainderMask = (1 << shift) - 1;
  const remainder = mantissa & remainderMask;

  let rounded = truncated;

  if (roundingMode === "RNE" && remainder !== 0) {
    const half = 1 << (shift - 1);
    const greaterThanHalf = remainder > half;
    const exactlyHalf = remainder === half;
    const lsbIsOdd = (truncated & 1) === 1;

    if (greaterThanHalf || (exactlyHalf && lsbIsOdd)) {
      rounded += 1;
    }
  }

  const limit = 1 << (23 - shift);
  if (rounded >= limit) {
    return { mantissa: 0, carry: true };
  }

  return { mantissa: rounded, carry: false };
}

function float32BitsToBfloat16(bits32: number, roundingMode: RoundingMode): bigint {
  const sign = (bits32 >>> 31) & 0x1;
  const exponent = (bits32 >>> 23) & 0xff;
  const mantissa = bits32 & 0x7fffff;

  if (exponent === 0xff) {
    if (mantissa === 0) {
      return BigInt((sign << 15) | 0x7f80);
    }

    const topMantissa = mantissa >>> 16;
    const quietPayload = topMantissa === 0 ? 0x40 : topMantissa;
    return BigInt((sign << 15) | 0x7f80 | quietPayload);
  }

  const rounded = roundMantissa(mantissa, 16, roundingMode);
  let nextExponent = exponent + (rounded.carry ? 1 : 0);

  if (nextExponent >= 0xff) {
    return BigInt((sign << 15) | 0x7f80);
  }

  return BigInt((sign << 15) | (nextExponent << 7) | rounded.mantissa);
}

function float32BitsToHalf(bits32: number, roundingMode: RoundingMode): bigint {
  const sign = (bits32 >>> 31) & 0x1;
  const exponent = (bits32 >>> 23) & 0xff;
  const mantissa = bits32 & 0x7fffff;
  const signHalf = sign << 15;

  if (exponent === 0xff) {
    if (mantissa === 0) {
      return BigInt(signHalf | 0x7c00);
    }

    const payload = mantissa >>> 13;
    const quietPayload = payload === 0 ? 0x0200 : payload;
    return BigInt(signHalf | 0x7c00 | quietPayload);
  }

  if (exponent === 0) {
    return BigInt(signHalf);
  }

  let halfExponent = exponent - 127 + 15;

  if (halfExponent >= 0x1f) {
    return BigInt(signHalf | 0x7c00);
  }

  if (halfExponent <= 0) {
    if (halfExponent < -10) {
      return BigInt(signHalf);
    }

    const mantissaWithHiddenBit = mantissa | 0x800000;
    const shift = 14 - halfExponent;
    let halfMantissa = mantissaWithHiddenBit >> shift;

    if (roundingMode === "RNE") {
      const remainderMask = (1 << shift) - 1;
      const remainder = mantissaWithHiddenBit & remainderMask;
      const half = 1 << (shift - 1);
      const greaterThanHalf = remainder > half;
      const exactlyHalf = remainder === half;
      const lsbIsOdd = (halfMantissa & 1) === 1;

      if (greaterThanHalf || (exactlyHalf && lsbIsOdd)) {
        halfMantissa += 1;
      }
    }

    return BigInt(signHalf | halfMantissa);
  }

  let halfMantissa = mantissa >> 13;

  if (roundingMode === "RNE") {
    const remainder = mantissa & 0x1fff;
    const greaterThanHalf = remainder > 0x1000;
    const exactlyHalf = remainder === 0x1000;
    const lsbIsOdd = (halfMantissa & 1) === 1;

    if (greaterThanHalf || (exactlyHalf && lsbIsOdd)) {
      halfMantissa += 1;
    }
  }

  if (halfMantissa === 0x400) {
    halfMantissa = 0;
    halfExponent += 1;

    if (halfExponent >= 0x1f) {
      return BigInt(signHalf | 0x7c00);
    }
  }

  return BigInt(signHalf | (halfExponent << 10) | halfMantissa);
}

export function encodeFloat(
  format: FormatDefinition,
  value: number,
  roundingMode: RoundingMode,
): EncodedValue {
  const bits32 = numberToFloat32Bits(value);
  let rawBits: bigint;

  switch (format.id) {
    case "FP32":
      return encodeFloat32(value, roundingMode);
    case "BF16":
      rawBits = float32BitsToBfloat16(bits32, roundingMode);
      break;
    case "FP16":
      rawBits = float32BitsToHalf(bits32, roundingMode);
      break;
    default:
      throw new Error(`${format.id}: float encoding not implemented`);
  }

  return {
    formatId: format.id,
    inputValue: value,
    roundingMode,
    rawBits,
    rawBinary: formatBinary(rawBits, format.bitWidth),
    rawHex: formatHex(rawBits, format.bitWidth),
    notes: [],
  };
}
