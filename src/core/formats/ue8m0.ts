import { ROUNDING_MODES } from "../constants/rounding.js";
import type { FormatDefinition } from "../model/format-definition.js";

export const ue8m0Format: FormatDefinition = {
  id: "UE8M0",
  displayName: "UE8M0",
  kind: "float",
  bitWidth: 8,
  hasSignBit: false,
  signBitCount: 0,
  exponentBitCount: 8,
  mantissaBitCount: 0,
  exponentBias: 127,
  supportsZero: false,
  supportsSignedZero: false,
  supportsSubnormal: false,
  supportsInfinity: false,
  supportsNaN: true,
  supportsQNaN: false,
  supportsSNaN: false,
  supportedClassifications: ["NORMAL", "NAN"],
  namedBoundaries: ["MIN_NORMAL", "MAX_NORMAL"],
  roundingModes: ROUNDING_MODES,
  overflowBehavior: "saturate",
  underflowBehavior: "saturate",
  notes: "OCP MX E8M0 scale type modeled here as an inspectable scalar unsigned power-of-two format.",
};
