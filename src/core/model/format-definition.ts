import type { Classification } from "../constants/classifications.js";
import type { AnyFormatId } from "../constants/format-id.js";
import type { FormatKind } from "../constants/format-kind.js";
import type { NamedBoundary } from "../constants/named-boundary.js";
import type { OverflowBehavior } from "../constants/overflow-behavior.js";
import type { RoundingMode } from "../constants/rounding.js";
import type { UnderflowBehavior } from "../constants/underflow-behavior.js";

export interface FormatDefinition {
  id: AnyFormatId;
  displayName: string;
  kind: FormatKind;
  bitWidth: number;
  hasSignBit: boolean;
  signBitCount: 0 | 1;
  exponentBitCount: number;
  mantissaBitCount: number;
  exponentBias: number | null;
  supportsZero: boolean;
  supportsSignedZero: boolean;
  supportsSubnormal: boolean;
  supportsInfinity: boolean;
  supportsNaN: boolean;
  supportsQNaN: boolean;
  supportsSNaN: boolean;
  supportedClassifications: readonly Classification[];
  namedBoundaries: readonly NamedBoundary[];
  roundingModes: readonly RoundingMode[];
  overflowBehavior: OverflowBehavior;
  underflowBehavior: UnderflowBehavior;
  notes?: string;
}

export function validateFormatDefinition(format: FormatDefinition): void {
  if (format.kind !== "integer") {
    const expectedBits =
      format.signBitCount + format.exponentBitCount + format.mantissaBitCount;

    if (expectedBits !== format.bitWidth) {
      throw new Error(
        `${format.id}: bit allocation mismatch (${expectedBits} != ${format.bitWidth})`,
      );
    }

    if (format.hasSignBit !== (format.signBitCount === 1)) {
      throw new Error(`${format.id}: hasSignBit does not match signBitCount`);
    }
  }

  if (format.supportsSignedZero && !format.supportsZero) {
    throw new Error(`${format.id}: signed zero requires zero support`);
  }

  if (format.supportsQNaN && !format.supportsNaN) {
    throw new Error(`${format.id}: qNaN support requires NaN support`);
  }

  if (format.supportsSNaN && !format.supportsNaN) {
    throw new Error(`${format.id}: sNaN support requires NaN support`);
  }

  if (format.kind === "integer") {
    if (format.exponentBitCount !== 0 || format.mantissaBitCount !== 0) {
      throw new Error(`${format.id}: integer formats cannot define exponent or mantissa bits`);
    }
    if (format.exponentBias !== null) {
      throw new Error(`${format.id}: integer formats must not define exponent bias`);
    }
    if (!format.hasSignBit || format.signBitCount !== 1) {
      throw new Error(`${format.id}: signed integer formats must declare integer sign semantics`);
    }
  }

  const supported = new Set(format.supportedClassifications);

  if (format.supportsZero && !supported.has("ZERO")) {
    throw new Error(`${format.id}: ZERO classification missing`);
  }

  if (format.supportsSubnormal && !supported.has("SUBNORMAL")) {
    throw new Error(`${format.id}: SUBNORMAL classification missing`);
  }

  if (format.supportsInfinity && !supported.has("INF")) {
    throw new Error(`${format.id}: INF classification missing`);
  }

  if (format.supportsNaN && !supported.has("NAN")) {
    throw new Error(`${format.id}: NAN classification missing`);
  }

  if (format.kind === "integer" && !supported.has("INTEGER")) {
    throw new Error(`${format.id}: INTEGER classification missing`);
  }
}
