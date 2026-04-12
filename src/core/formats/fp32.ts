import { ROUNDING_MODES } from "../constants/rounding.js";
import type { FormatDefinition } from "../model/format-definition.js";

export const fp32Format: FormatDefinition = {
  id: "FP32",
  displayName: "FP32",
  kind: "float",
  bitWidth: 32,
  hasSignBit: true,
  signBitCount: 1,
  exponentBitCount: 8,
  mantissaBitCount: 23,
  exponentBias: 127,
  supportsZero: true,
  supportsSignedZero: true,
  supportsSubnormal: true,
  supportsInfinity: true,
  supportsNaN: true,
  supportsQNaN: true,
  supportsSNaN: true,
  supportedClassifications: ["ZERO", "SUBNORMAL", "NORMAL", "INF", "NAN"],
  namedBoundaries: ["MIN_SUBNORMAL", "MAX_SUBNORMAL", "MIN_NORMAL", "MAX_NORMAL"],
  roundingModes: ROUNDING_MODES,
  overflowBehavior: "infinity",
  underflowBehavior: "subnormal",
  notes: "IEEE 754 binary32.",
};
