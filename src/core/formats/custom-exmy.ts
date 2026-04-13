import { CUSTOM_FLOAT_FORMAT_ID } from "../constants/format-id.js";
import type { CustomFloatSpec } from "../model/custom-float-spec.js";
import type { FormatDefinition } from "../model/format-definition.js";
import { validateFormatDefinition } from "../model/format-definition.js";

const MIN_EXPONENT_BITS = 2;
const MAX_EXPONENT_BITS = 10;
const MIN_MANTISSA_BITS = 0;
const MAX_MANTISSA_BITS = 23;

export function getCustomFloatSignature(spec: CustomFloatSpec): string {
  return [
    CUSTOM_FLOAT_FORMAT_ID,
    spec.hasSignBit ? "S1" : "S0",
    `E${spec.exponentBitCount}`,
    `M${spec.mantissaBitCount}`,
    spec.supportsInfinity ? "I1" : "I0",
    spec.supportsNaN ? "N1" : "N0",
  ].join("-");
}

export function getCustomFloatLabel(spec: CustomFloatSpec): string {
  return `${CUSTOM_FLOAT_FORMAT_ID} (S${spec.hasSignBit ? 1 : 0} E${spec.exponentBitCount} M${spec.mantissaBitCount})`;
}

export function validateCustomFloatSpec(spec: CustomFloatSpec): void {
  if (!Number.isInteger(spec.exponentBitCount)) {
    throw new Error("ExMy exponent bits must be an integer");
  }

  if (!Number.isInteger(spec.mantissaBitCount)) {
    throw new Error("ExMy mantissa bits must be an integer");
  }

  if (spec.exponentBitCount < MIN_EXPONENT_BITS || spec.exponentBitCount > MAX_EXPONENT_BITS) {
    throw new Error(`ExMy exponent bits must be between ${MIN_EXPONENT_BITS} and ${MAX_EXPONENT_BITS}`);
  }

  if (spec.mantissaBitCount < MIN_MANTISSA_BITS || spec.mantissaBitCount > MAX_MANTISSA_BITS) {
    throw new Error(`ExMy mantissa bits must be between ${MIN_MANTISSA_BITS} and ${MAX_MANTISSA_BITS}`);
  }

  if (spec.supportsNaN && spec.mantissaBitCount === 0) {
    throw new Error("ExMy NaN support requires at least one mantissa bit");
  }
}

export function createCustomFloatFormat(spec: CustomFloatSpec): FormatDefinition {
  validateCustomFloatSpec(spec);

  const bitWidth = (spec.hasSignBit ? 1 : 0) + spec.exponentBitCount + spec.mantissaBitCount;
  const exponentBias = 2 ** (spec.exponentBitCount - 1) - 1;
  const supportsSubnormal = spec.mantissaBitCount > 0;
  const namedBoundaries = supportsSubnormal
    ? ["MIN_SUBNORMAL", "MAX_SUBNORMAL", "MIN_NORMAL", "MAX_NORMAL", "MIN_VALUE", "MAX_VALUE"] as const
    : ["MIN_NORMAL", "MAX_NORMAL", "MIN_VALUE", "MAX_VALUE"] as const;
  const supportedClassifications = [
    "ZERO",
    ...(supportsSubnormal ? (["SUBNORMAL"] as const) : []),
    "NORMAL",
    ...(spec.supportsInfinity ? (["INF"] as const) : []),
    ...(spec.supportsNaN ? (["NAN"] as const) : []),
  ] as const;

  const format: FormatDefinition = {
    id: CUSTOM_FLOAT_FORMAT_ID,
    displayName: getCustomFloatLabel(spec),
    kind: spec.hasSignBit ? "float" : "unsigned-float",
    bitWidth,
    hasSignBit: spec.hasSignBit,
    signBitCount: spec.hasSignBit ? 1 : 0,
    exponentBitCount: spec.exponentBitCount,
    mantissaBitCount: spec.mantissaBitCount,
    exponentBias,
    supportsZero: true,
    supportsSignedZero: spec.hasSignBit,
    supportsSubnormal,
    supportsInfinity: spec.supportsInfinity,
    supportsNaN: spec.supportsNaN,
    supportsQNaN: spec.supportsNaN && spec.mantissaBitCount >= 1,
    supportsSNaN: spec.supportsNaN && spec.mantissaBitCount >= 2,
    supportedClassifications,
    namedBoundaries,
    roundingModes: ["RNE", "RTZ", "RTP"],
    overflowBehavior: spec.supportsInfinity ? "infinity" : "saturate",
    underflowBehavior: supportsSubnormal ? "subnormal" : "zero",
    notes: "Inspection-only custom IEEE-like binary float profile.",
  };

  validateFormatDefinition(format);
  return format;
}
