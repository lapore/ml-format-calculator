import { ROUNDING_MODES } from "../constants/rounding.js";
import type { FormatDefinition } from "../model/format-definition.js";

export const e2m1Format: FormatDefinition = {
  id: "E2M1",
  displayName: "E2M1",
  kind: "float",
  bitWidth: 4,
  hasSignBit: true,
  signBitCount: 1,
  exponentBitCount: 2,
  mantissaBitCount: 1,
  exponentBias: 1,
  supportsZero: true,
  supportsSignedZero: true,
  supportsSubnormal: true,
  supportsInfinity: false,
  supportsNaN: false,
  supportsQNaN: false,
  supportsSNaN: false,
  supportedClassifications: ["ZERO", "SUBNORMAL", "NORMAL"],
  namedBoundaries: ["MIN_SUBNORMAL", "MAX_SUBNORMAL", "MIN_NORMAL", "MAX_NORMAL"],
  roundingModes: ROUNDING_MODES,
  overflowBehavior: "saturate",
  underflowBehavior: "zero",
  notes: "OCP MX FP4 E2M1 profile with SAT overflow behavior and no Inf/NaN encodings.",
};
