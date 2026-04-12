import { ROUNDING_MODES } from "../constants/rounding.js";
import type { FormatDefinition } from "../model/format-definition.js";

export const int32Format: FormatDefinition = {
  id: "INT32",
  displayName: "INT32",
  kind: "integer",
  bitWidth: 32,
  hasSignBit: true,
  signBitCount: 1,
  exponentBitCount: 0,
  mantissaBitCount: 0,
  exponentBias: null,
  supportsZero: true,
  supportsSignedZero: false,
  supportsSubnormal: false,
  supportsInfinity: false,
  supportsNaN: false,
  supportsQNaN: false,
  supportsSNaN: false,
  supportedClassifications: ["ZERO", "INTEGER"],
  namedBoundaries: ["MIN_VALUE", "MAX_VALUE"],
  roundingModes: ROUNDING_MODES,
  overflowBehavior: "error",
  underflowBehavior: "error",
  notes: "Signed 32-bit integer.",
};
