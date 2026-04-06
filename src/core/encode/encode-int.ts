import type { RoundingMode } from "../constants/rounding.js";
import type { EncodedValue } from "../model/encoded-value.js";
import type { FormatDefinition } from "../model/format-definition.js";
import { formatBinary, formatHex } from "../utils/bits.js";

function roundToNearestEven(value: number): number {
  const floor = Math.floor(value);
  const fraction = value - floor;

  if (fraction < 0.5) {
    return floor;
  }

  if (fraction > 0.5) {
    return floor + 1;
  }

  return floor % 2 === 0 ? floor : floor + 1;
}

function applyIntegerRounding(value: number, roundingMode: RoundingMode): number {
  if (roundingMode === "RTZ") {
    return value < 0 ? Math.ceil(value) : Math.floor(value);
  }

  return roundToNearestEven(value);
}

export function encodeInt(
  format: FormatDefinition,
  value: number,
  roundingMode: RoundingMode,
): EncodedValue {
  if (format.id !== "INT32") {
    throw new Error(`${format.id}: integer encoding not implemented`);
  }

  if (!Number.isFinite(value)) {
    throw new Error(`${format.id}: cannot encode non-finite number as integer`);
  }

  const rounded = applyIntegerRounding(value, roundingMode);
  const min = -2147483648;
  const max = 2147483647;

  if (rounded < min || rounded > max) {
    throw new Error(`${format.id}: integer overflow`);
  }

  const signedValue = BigInt(rounded);
  const rawBits = signedValue < 0 ? (1n << 32n) + signedValue : signedValue;

  return {
    formatId: format.id,
    inputValue: value,
    roundingMode,
    rawBits,
    rawBinary: formatBinary(rawBits, format.bitWidth),
    rawHex: formatHex(rawBits, format.bitWidth),
    notes: [],
  };
}
