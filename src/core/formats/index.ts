import type { FormatId } from "../constants/format-id.js";
import type { FormatDefinition } from "../model/format-definition.js";
import { validateFormatDefinition } from "../model/format-definition.js";
import { bf16Format } from "./bf16.js";
import { fp16Format } from "./fp16.js";
import { fp32Format } from "./fp32.js";
import { int32Format } from "./int32.js";

export const formatRegistry: Record<FormatId, FormatDefinition> = {
  FP32: fp32Format,
  BF16: bf16Format,
  FP16: fp16Format,
  E4M3: {
    id: "E4M3",
    displayName: "E4M3",
    kind: "float",
    bitWidth: 8,
    hasSignBit: true,
    signBitCount: 1,
    exponentBitCount: 4,
    mantissaBitCount: 3,
    exponentBias: null,
    supportsZero: true,
    supportsSignedZero: true,
    supportsSubnormal: false,
    supportsInfinity: false,
    supportsNaN: false,
    supportsQNaN: false,
    supportsSNaN: false,
    supportedClassifications: ["ZERO", "NORMAL", "UNREPRESENTABLE"],
    namedBoundaries: [],
    roundingModes: ["RNE", "RTZ"],
    overflowBehavior: "saturate",
    underflowBehavior: "zero",
    notes: "Placeholder definition pending exact E4M3 variant selection.",
  },
  E2M1: {
    id: "E2M1",
    displayName: "E2M1",
    kind: "float",
    bitWidth: 4,
    hasSignBit: true,
    signBitCount: 1,
    exponentBitCount: 2,
    mantissaBitCount: 1,
    exponentBias: null,
    supportsZero: true,
    supportsSignedZero: true,
    supportsSubnormal: false,
    supportsInfinity: false,
    supportsNaN: false,
    supportsQNaN: false,
    supportsSNaN: false,
    supportedClassifications: ["ZERO", "NORMAL", "UNREPRESENTABLE"],
    namedBoundaries: [],
    roundingModes: ["RNE", "RTZ"],
    overflowBehavior: "saturate",
    underflowBehavior: "zero",
    notes: "Placeholder definition pending exact E2M1 variant selection.",
  },
  E5M2: {
    id: "E5M2",
    displayName: "E5M2",
    kind: "float",
    bitWidth: 8,
    hasSignBit: true,
    signBitCount: 1,
    exponentBitCount: 5,
    mantissaBitCount: 2,
    exponentBias: null,
    supportsZero: true,
    supportsSignedZero: true,
    supportsSubnormal: false,
    supportsInfinity: false,
    supportsNaN: false,
    supportsQNaN: false,
    supportsSNaN: false,
    supportedClassifications: ["ZERO", "NORMAL", "UNREPRESENTABLE"],
    namedBoundaries: [],
    roundingModes: ["RNE", "RTZ"],
    overflowBehavior: "saturate",
    underflowBehavior: "zero",
    notes: "Placeholder definition pending exact E5M2 variant selection.",
  },
  INT32: int32Format,
};

export const formats = Object.values(formatRegistry);

for (const format of formats) {
  validateFormatDefinition(format);
}

export function getFormatDefinition(id: FormatId): FormatDefinition {
  return formatRegistry[id];
}
