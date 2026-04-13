import { CUSTOM_FLOAT_FORMAT_ID, type FormatId, type SourceFormatId } from "../core/constants/format-id.js";
import { decodeBitsForFormat } from "../core/decode/index.js";
import { createCustomFloatFormat, getCustomFloatLabel, getCustomFloatSignature } from "../core/formats/custom-exmy.js";
import type { CustomFloatSpec } from "../core/model/custom-float-spec.js";
import { formatBinary, formatHex } from "../core/utils/bits.js";

export type Preset = {
  label: string;
  value: string;
};

export const DEFAULT_EXMY_SPEC: CustomFloatSpec = {
  hasSignBit: true,
  exponentBitCount: 5,
  mantissaBitCount: 2,
  supportsInfinity: true,
  supportsNaN: true,
};

export const FIXED_SOURCE_FORMATS: readonly FormatId[] = [
  "FP32",
  "BF16",
  "FP16",
  "E5M2",
  "E4M3",
  "E2M1",
  "UE8M0",
  "INT32",
] as const;

export const INSPECTION_SOURCE_FORMATS: readonly SourceFormatId[] = [
  ...FIXED_SOURCE_FORMATS,
  CUSTOM_FLOAT_FORMAT_ID,
] as const;

function getExponentAllOnes(format: ReturnType<typeof createCustomFloatFormat>): bigint {
  return (1n << BigInt(format.exponentBitCount)) - 1n;
}

function getSignField(
  format: ReturnType<typeof createCustomFloatFormat>,
  negative: boolean,
): bigint {
  if (!format.hasSignBit || !negative) {
    return 0n;
  }

  return 1n << BigInt(format.exponentBitCount + format.mantissaBitCount);
}

function getMaxFiniteStoredExponent(format: ReturnType<typeof createCustomFloatFormat>): number {
  const maxExponent = Number(getExponentAllOnes(format));
  const hasFiniteAllOnesZeroMantissa = !format.supportsInfinity;
  const hasFiniteAllOnesNonZeroMantissas = format.mantissaBitCount > 0 && !format.supportsNaN;

  if (hasFiniteAllOnesNonZeroMantissas || hasFiniteAllOnesZeroMantissa) {
    return maxExponent;
  }

  return maxExponent - 1;
}

function getMaxFiniteMantissa(format: ReturnType<typeof createCustomFloatFormat>): bigint {
  const hasFiniteAllOnesZeroMantissa = !format.supportsInfinity;
  const hasFiniteAllOnesNonZeroMantissas = format.mantissaBitCount > 0 && !format.supportsNaN;

  if (hasFiniteAllOnesNonZeroMantissas) {
    return (1n << BigInt(format.mantissaBitCount)) - 1n;
  }

  if (hasFiniteAllOnesZeroMantissa) {
    return 0n;
  }

  return format.mantissaBitCount === 0 ? 0n : (1n << BigInt(format.mantissaBitCount)) - 1n;
}

function getRawBits(
  format: ReturnType<typeof createCustomFloatFormat>,
  negative: boolean,
  storedExponent: number,
  mantissa: bigint,
): bigint {
  return getSignField(format, negative) | (BigInt(storedExponent) << BigInt(format.mantissaBitCount)) | mantissa;
}

function getRawPresetValue(spec: CustomFloatSpec, rawBits: bigint, inputMode: "hex" | "binary"): string {
  const format = createCustomFloatFormat(spec);
  return inputMode === "hex"
    ? formatHex(rawBits, format.bitWidth)
    : formatBinary(rawBits, format.bitWidth);
}

function buildRawBoundaryEntries(spec: CustomFloatSpec): Array<{ label: string; rawBits: bigint }> {
  const format = createCustomFloatFormat(spec);
  const entries: Array<{ label: string; rawBits: bigint }> = [
    { label: "+0", rawBits: getSignField(format, false) },
  ];

  if (format.hasSignBit) {
    entries.push({ label: "-0", rawBits: getSignField(format, true) });
  }

  if (format.supportsSubnormal) {
    entries.push({ label: "min subnormal", rawBits: getRawBits(format, false, 0, 1n) });
    entries.push({
      label: "max subnormal",
      rawBits: getRawBits(format, false, 0, (1n << BigInt(format.mantissaBitCount)) - 1n),
    });
  }

  entries.push({ label: "min normal", rawBits: getRawBits(format, false, 1, 0n) });
  entries.push({
    label: "max normal",
    rawBits: getRawBits(
      format,
      false,
      getMaxFiniteStoredExponent(format),
      getMaxFiniteMantissa(format),
    ),
  });

  if (format.supportsInfinity) {
    entries.push({
      label: "+inf",
      rawBits: getSignField(format, false) | (getExponentAllOnes(format) << BigInt(format.mantissaBitCount)),
    });

    if (format.hasSignBit) {
      entries.push({
        label: "-inf",
        rawBits: getSignField(format, true) | (getExponentAllOnes(format) << BigInt(format.mantissaBitCount)),
      });
    }
  }

  if (format.supportsNaN) {
    entries.push({
      label: "qNaN",
      rawBits:
        (getExponentAllOnes(format) << BigInt(format.mantissaBitCount)) |
        (1n << BigInt(Math.max(0, format.mantissaBitCount - 1))),
    });

    if (format.mantissaBitCount > 1) {
      entries.push({
        label: "sNaN",
        rawBits: (getExponentAllOnes(format) << BigInt(format.mantissaBitCount)) | 1n,
      });
    }
  }

  return entries;
}

export function getExMyPresetHint(spec: CustomFloatSpec, inputMode: "decimal" | "hex" | "binary"): string {
  const label = getCustomFloatLabel(spec);
  if (inputMode === "decimal") {
    return `Showing decimal presets for ${label}.`;
  }

  return `Showing ${inputMode} presets for ${label}.`;
}

export function buildExMyPresets(spec: CustomFloatSpec, inputMode: "decimal" | "hex" | "binary"): Preset[] {
  const format = createCustomFloatFormat(spec);
  const rawEntries = buildRawBoundaryEntries(spec);

  if (inputMode !== "decimal") {
    return rawEntries.map((entry) => ({
      label: entry.label,
      value: getRawPresetValue(spec, entry.rawBits, inputMode),
    }));
  }

  return rawEntries.map((entry) => {
    const decoded = decodeBitsForFormat(format, entry.rawBits);
    return {
      label: entry.label,
      value: decoded.isNaN
        ? "nan"
        : decoded.isInfinity
          ? decoded.sign === "NEG"
            ? "-inf"
            : "+inf"
          : decoded.decimalValueText,
    };
  });
}

export function getExMyRequestSignature(spec: CustomFloatSpec): string {
  return getCustomFloatSignature(spec);
}
