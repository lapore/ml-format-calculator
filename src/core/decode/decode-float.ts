import type { FormatDefinition } from "../model/format-definition.js";
import type { DecodedValue } from "../model/decoded-value.js";
import { formatBinary, formatHex, maskForWidth } from "../utils/bits.js";

type FloatFields = {
  sign: number;
  signKind: "POS" | "NEG" | "NONE";
  signBitValue: number;
  signBit: string | null;
  exponentValue: number;
  exponentBits: string | null;
  mantissaValue: bigint;
  mantissaBits: string | null;
  maxExponent: number;
  mantissaMask: bigint;
  rawBinary: string;
  rawHex: string;
};

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

function extractFloatFields(format: FormatDefinition, rawBits: bigint): FloatFields {
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

  return {
    sign: signBitValue === 1 ? -1 : 1,
    signKind: format.hasSignBit ? (signBitValue === 1 ? "NEG" : "POS") : "NONE",
    signBitValue,
    signBit: format.hasSignBit ? String(signBitValue) : null,
    exponentValue,
    exponentBits: formatBinary(BigInt(exponentValue), format.exponentBitCount),
    mantissaValue,
    mantissaBits: formatBinary(mantissaValue, format.mantissaBitCount),
    maxExponent,
    mantissaMask,
    rawBinary,
    rawHex,
  };
}

function buildZeroDecodedValue(
  format: FormatDefinition,
  rawBits: bigint,
  fields: FloatFields,
): DecodedValue {
  return {
    formatId: format.id,
    rawBits,
    rawBinary: fields.rawBinary,
    rawHex: fields.rawHex,
    classification: "ZERO",
    sign: fields.signKind,
    signBit: fields.signBit,
    exponentBits: fields.exponentBits,
    mantissaBits: fields.mantissaBits,
    exponentBias: format.exponentBias,
    storedBiasedExponent: 0,
    actualExponent: null,
    decimalValue: fields.signBitValue === 1 ? -0 : 0,
    decimalValueText: fields.signBitValue === 1 ? "-0" : "0",
    isZero: true,
    isSubnormal: false,
    isNormal: false,
    isInfinity: false,
    isNaN: false,
    nanKind: null,
  };
}

function buildSubnormalDecodedValue(
  format: FormatDefinition,
  rawBits: bigint,
  fields: FloatFields,
): DecodedValue {
  if (format.exponentBias === null) {
    throw new Error(`${format.id}: floating decode requires exponent bias`);
  }

  const actualExponent = 1 - format.exponentBias;
  const decimalValue = decodeFloatDecimal(
    fields.sign,
    actualExponent,
    fields.mantissaValue,
    format.mantissaBitCount,
    false,
  );

  return {
    formatId: format.id,
    rawBits,
    rawBinary: fields.rawBinary,
    rawHex: fields.rawHex,
    classification: "SUBNORMAL",
    sign: fields.signKind,
    signBit: fields.signBit,
    exponentBits: fields.exponentBits,
    mantissaBits: fields.mantissaBits,
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

function buildNormalDecodedValue(
  format: FormatDefinition,
  rawBits: bigint,
  fields: FloatFields,
  exponentValue = fields.exponentValue,
): DecodedValue {
  if (format.exponentBias === null) {
    throw new Error(`${format.id}: floating decode requires exponent bias`);
  }

  const actualExponent = exponentValue - format.exponentBias;
  const decimalValue = decodeFloatDecimal(
    fields.sign,
    actualExponent,
    fields.mantissaValue,
    format.mantissaBitCount,
    true,
  );

  return {
    formatId: format.id,
    rawBits,
    rawBinary: fields.rawBinary,
    rawHex: fields.rawHex,
    classification: "NORMAL",
    sign: fields.signKind,
    signBit: fields.signBit,
    exponentBits: fields.exponentBits,
    mantissaBits: fields.mantissaBits,
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

function buildInfinityDecodedValue(
  format: FormatDefinition,
  rawBits: bigint,
  fields: FloatFields,
): DecodedValue {
  return {
    formatId: format.id,
    rawBits,
    rawBinary: fields.rawBinary,
    rawHex: fields.rawHex,
    classification: "INF",
    sign: fields.signKind,
    signBit: fields.signBit,
    exponentBits: fields.exponentBits,
    mantissaBits: fields.mantissaBits,
    exponentBias: format.exponentBias,
    storedBiasedExponent: fields.exponentValue,
    actualExponent: null,
    decimalValue: fields.sign === -1 ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
    decimalValueText: fields.sign === -1 ? "-inf" : "+inf",
    isZero: false,
    isSubnormal: false,
    isNormal: false,
    isInfinity: true,
    isNaN: false,
    nanKind: null,
  };
}

function buildNaNDecodedValue(
  format: FormatDefinition,
  rawBits: bigint,
  fields: FloatFields,
  nanKind: "quiet" | "signaling" | null,
): DecodedValue {
  return {
    formatId: format.id,
    rawBits,
    rawBinary: fields.rawBinary,
    rawHex: fields.rawHex,
    classification: "NAN",
    sign: fields.signKind,
    signBit: fields.signBit,
    exponentBits: fields.exponentBits,
    mantissaBits: fields.mantissaBits,
    exponentBias: format.exponentBias,
    storedBiasedExponent: fields.exponentValue,
    actualExponent: null,
    decimalValue: Number.NaN,
    decimalValueText:
      nanKind === "quiet"
        ? "qNaN"
        : nanKind === "signaling"
          ? "sNaN"
          : "NaN",
    isZero: false,
    isSubnormal: false,
    isNormal: false,
    isInfinity: false,
    isNaN: true,
    nanKind,
  };
}

function decodeIeeeLikeFloat(
  format: FormatDefinition,
  rawBits: bigint,
  fields: FloatFields,
): DecodedValue {
  if (fields.exponentValue === 0 && fields.mantissaValue === 0n) {
    return buildZeroDecodedValue(format, rawBits, fields);
  }

  if (fields.exponentValue === 0 && fields.mantissaValue !== 0n) {
    return buildSubnormalDecodedValue(format, rawBits, fields);
  }

  if (fields.exponentValue === fields.maxExponent && fields.mantissaValue === 0n) {
    return buildInfinityDecodedValue(format, rawBits, fields);
  }

  if (fields.exponentValue === fields.maxExponent) {
    const quietBitShift = BigInt(format.mantissaBitCount - 1);
    const quietBit = Number((fields.mantissaValue >> quietBitShift) & 1n);
    return buildNaNDecodedValue(
      format,
      rawBits,
      fields,
      quietBit === 1 ? "quiet" : "signaling",
    );
  }

  return buildNormalDecodedValue(format, rawBits, fields);
}

function decodeOcpE5M2(
  format: FormatDefinition,
  rawBits: bigint,
  fields: FloatFields,
): DecodedValue {
  if (fields.exponentValue === 0 && fields.mantissaValue === 0n) {
    return buildZeroDecodedValue(format, rawBits, fields);
  }

  if (fields.exponentValue === 0 && fields.mantissaValue !== 0n) {
    return buildSubnormalDecodedValue(format, rawBits, fields);
  }

  if (fields.exponentValue === fields.maxExponent && fields.mantissaValue === 0n) {
    return buildInfinityDecodedValue(format, rawBits, fields);
  }

  if (fields.exponentValue === fields.maxExponent) {
    return buildNaNDecodedValue(format, rawBits, fields, null);
  }

  return buildNormalDecodedValue(format, rawBits, fields);
}

function decodeOcpE4M3(
  format: FormatDefinition,
  rawBits: bigint,
  fields: FloatFields,
): DecodedValue {
  if (fields.exponentValue === 0 && fields.mantissaValue === 0n) {
    return buildZeroDecodedValue(format, rawBits, fields);
  }

  if (fields.exponentValue === 0 && fields.mantissaValue !== 0n) {
    return buildSubnormalDecodedValue(format, rawBits, fields);
  }

  if (
    fields.exponentValue === fields.maxExponent &&
    fields.mantissaValue === fields.mantissaMask
  ) {
    return buildNaNDecodedValue(format, rawBits, fields, null);
  }

  return buildNormalDecodedValue(format, rawBits, fields);
}

function decodeOcpE2M1(
  format: FormatDefinition,
  rawBits: bigint,
  fields: FloatFields,
): DecodedValue {
  if (fields.exponentValue === 0 && fields.mantissaValue === 0n) {
    return buildZeroDecodedValue(format, rawBits, fields);
  }

  if (fields.exponentValue === 0 && fields.mantissaValue !== 0n) {
    return buildSubnormalDecodedValue(format, rawBits, fields);
  }

  return buildNormalDecodedValue(format, rawBits, fields);
}

function decodeUnsignedE8M0(
  format: FormatDefinition,
  rawBits: bigint,
  fields: FloatFields,
): DecodedValue {
  if (fields.exponentValue === fields.maxExponent) {
    return buildNaNDecodedValue(format, rawBits, fields, null);
  }

  return buildNormalDecodedValue(format, rawBits, fields);
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

  const fields = extractFloatFields(format, rawBits);

  switch (format.id) {
    case "E5M2":
      return decodeOcpE5M2(format, rawBits, fields);
    case "E4M3":
      return decodeOcpE4M3(format, rawBits, fields);
    case "E2M1":
      return decodeOcpE2M1(format, rawBits, fields);
    case "UE8M0":
      return decodeUnsignedE8M0(format, rawBits, fields);
    default:
      return decodeIeeeLikeFloat(format, rawBits, fields);
  }
}
