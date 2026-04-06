import type { FormatDefinition } from "../model/format-definition.js";
import type { DecodedValue } from "../model/decoded-value.js";
import { formatBinary, formatHex, maskForWidth } from "../utils/bits.js";

function decodeFloatDecimal(
  sign: number,
  actualExponent: number,
  mantissaValue: bigint,
  mantissaBitCount: number,
  hasImplicitLeadingOne: boolean,
): number {
  const fraction = Number(mantissaValue) / 2 ** mantissaBitCount;
  const significand = hasImplicitLeadingOne ? 1 + fraction : fraction;
  return sign * significand * 2 ** actualExponent;
}

export function decodeFloat(
  format: FormatDefinition,
  rawBits: bigint,
): DecodedValue {
  if (format.kind === "integer") {
    throw new Error(`${format.id}: integer formats must use decodeInt`);
  }

  if (format.exponentBias === null) {
    throw new Error(`${format.id}: floating decode requires exponent bias`);
  }

  const widthMask = maskForWidth(format.bitWidth);
  if (rawBits < 0 || rawBits > widthMask) {
    throw new Error(`${format.id}: raw bits out of range for ${format.bitWidth}-bit format`);
  }

  const rawBinary = formatBinary(rawBits, format.bitWidth);
  const rawHex = formatHex(rawBits, format.bitWidth);

  const signShift = BigInt(format.exponentBitCount + format.mantissaBitCount);
  const exponentMask = maskForWidth(format.exponentBitCount);
  const mantissaMask = maskForWidth(format.mantissaBitCount);

  const signBitValue = format.hasSignBit ? Number((rawBits >> signShift) & 1n) : 0;
  const exponentValue = Number((rawBits >> BigInt(format.mantissaBitCount)) & exponentMask);
  const mantissaValue = rawBits & mantissaMask;
  const maxExponent = Number(exponentMask);

  const sign = signBitValue === 1 ? -1 : 1;
  const signKind = format.hasSignBit ? (signBitValue === 1 ? "NEG" : "POS") : "NONE";
  const signBit = format.hasSignBit ? String(signBitValue) : null;
  const exponentBits = formatBinary(BigInt(exponentValue), format.exponentBitCount);
  const mantissaBits = formatBinary(mantissaValue, format.mantissaBitCount);

  if (exponentValue === 0 && mantissaValue === 0n) {
    return {
      formatId: format.id,
      rawBits,
      rawBinary,
      rawHex,
      classification: "ZERO",
      sign: signKind,
      signBit,
      exponentBits,
      mantissaBits,
      exponentBias: format.exponentBias,
      storedBiasedExponent: 0,
      actualExponent: null,
      decimalValue: signBitValue === 1 ? -0 : 0,
      decimalValueText: signBitValue === 1 ? "-0" : "0",
      isZero: true,
      isSubnormal: false,
      isNormal: false,
      isInfinity: false,
      isNaN: false,
      nanKind: null,
    };
  }

  if (exponentValue === 0 && mantissaValue !== 0n) {
    const actualExponent = 1 - format.exponentBias;
    const decimalValue = decodeFloatDecimal(
      sign,
      actualExponent,
      mantissaValue,
      format.mantissaBitCount,
      false,
    );

    return {
      formatId: format.id,
      rawBits,
      rawBinary,
      rawHex,
      classification: "SUBNORMAL",
      sign: signKind,
      signBit,
      exponentBits,
      mantissaBits,
      exponentBias: format.exponentBias,
      storedBiasedExponent: 0,
      actualExponent,
      decimalValue,
      decimalValueText: String(decimalValue),
      isZero: false,
      isSubnormal: true,
      isNormal: false,
      isInfinity: false,
      isNaN: false,
      nanKind: null,
    };
  }

  if (exponentValue === maxExponent && mantissaValue === 0n) {
    return {
      formatId: format.id,
      rawBits,
      rawBinary,
      rawHex,
      classification: "INF",
      sign: signKind,
      signBit,
      exponentBits,
      mantissaBits,
      exponentBias: format.exponentBias,
      storedBiasedExponent: exponentValue,
      actualExponent: null,
      decimalValue: sign === -1 ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      decimalValueText: sign === -1 ? "-inf" : "+inf",
      isZero: false,
      isSubnormal: false,
      isNormal: false,
      isInfinity: true,
      isNaN: false,
      nanKind: null,
    };
  }

  if (exponentValue === maxExponent) {
    const quietBitShift = BigInt(format.mantissaBitCount - 1);
    const quietBit = Number((mantissaValue >> quietBitShift) & 1n);
    const nanKind = quietBit === 1 ? "quiet" : "signaling";

    return {
      formatId: format.id,
      rawBits,
      rawBinary,
      rawHex,
      classification: "NAN",
      sign: signKind,
      signBit,
      exponentBits,
      mantissaBits,
      exponentBias: format.exponentBias,
      storedBiasedExponent: exponentValue,
      actualExponent: null,
      decimalValue: Number.NaN,
      decimalValueText: nanKind === "quiet" ? "qNaN" : "sNaN",
      isZero: false,
      isSubnormal: false,
      isNormal: false,
      isInfinity: false,
      isNaN: true,
      nanKind,
    };
  }

  const actualExponent = exponentValue - format.exponentBias;
  const decimalValue = decodeFloatDecimal(
    sign,
    actualExponent,
    mantissaValue,
    format.mantissaBitCount,
    true,
  );

  return {
    formatId: format.id,
    rawBits,
    rawBinary,
    rawHex,
    classification: "NORMAL",
    sign: signKind,
    signBit,
    exponentBits,
    mantissaBits,
    exponentBias: format.exponentBias,
    storedBiasedExponent: exponentValue,
    actualExponent,
    decimalValue,
    decimalValueText: String(decimalValue),
    isZero: false,
    isSubnormal: false,
    isNormal: true,
    isInfinity: false,
    isNaN: false,
    nanKind: null,
  };
}
