import type { FormatId } from "../constants/format-id.js";
import { getDefaultCanonicalNaNHex } from "../constants/nan-policy.js";
import type { RoundingMode } from "../constants/rounding.js";
import { decodeRawBits } from "../decode/index.js";
import type { DecodedValue } from "../model/decoded-value.js";
import type { EncodedValue } from "../model/encoded-value.js";
import type { FormatDefinition } from "../model/format-definition.js";
import { formatBinary, formatHex } from "../utils/bits.js";
import { numberToFloat32Bits } from "./float32-bits.js";

type FiniteFloatCandidate = DecodedValue & {
  decimalValue: number;
};

const finiteFloatCandidateCache = new Map<FormatId, FiniteFloatCandidate[]>();
const signedFiniteCandidateCache = new Map<`${FormatId}:${"POS" | "NEG"}`, FiniteFloatCandidate[]>();
const maxFiniteCandidateCache = new Map<`${FormatId}:${"POS" | "NEG"}`, FiniteFloatCandidate>();
const orderedFiniteCandidateCache = new Map<FormatId, FiniteFloatCandidate[]>();
const zeroFiniteCandidateCache = new Map<FormatId, FiniteFloatCandidate | null>();
const maxUnsignedFiniteCandidateCache = new Map<FormatId, FiniteFloatCandidate>();
const minPositiveFiniteCandidateCache = new Map<FormatId, FiniteFloatCandidate>();

function stepFloat32TowardPositiveInfinity(rawBits: number, value: number): number {
  return value > 0 ? rawBits + 1 : rawBits - 1;
}

function shouldStepFloat32Directed(
  inputValue: number,
  roundedValue: number,
  roundingMode: RoundingMode,
): boolean {
  if (roundingMode === "RTZ") {
    if (inputValue > 0) {
      return roundedValue > inputValue;
    }

    return roundedValue < inputValue;
  }

  if (roundingMode === "RTP") {
    return roundedValue < inputValue;
  }

  return false;
}

function applyFloat32DirectedAdjustment(value: number, rawBits: number, roundingMode: RoundingMode): number {
  if (!Number.isFinite(value) || Object.is(value, 0) || Object.is(value, -0)) {
    return rawBits;
  }

  const rounded = decodeRawBits("FP32", BigInt(rawBits));
  if (rounded.decimalValue === null || Number.isNaN(rounded.decimalValue)) {
    return rawBits;
  }

  if (!shouldStepFloat32Directed(value, rounded.decimalValue, roundingMode)) {
    return rawBits;
  }

  if (roundingMode === "RTZ") {
    return rawBits - 1;
  }

  if (roundingMode === "RTP") {
    return stepFloat32TowardPositiveInfinity(rawBits, value);
  }

  return rawBits;
}

function encodeFloat32(value: number, roundingMode: RoundingMode): EncodedValue {
  const rneBits = numberToFloat32Bits(value);
  let adjustedBits = rneBits;

  if (Number.isFinite(value) && (rneBits === 0x7f800000 || rneBits === 0xff800000)) {
    if (roundingMode === "RTZ") {
      adjustedBits = value > 0 ? 0x7f7fffff : 0xff7fffff;
    } else if (roundingMode === "RTP" && value < 0) {
      adjustedBits = 0xff7fffff;
    }
  } else if (roundingMode !== "RNE") {
    adjustedBits = applyFloat32DirectedAdjustment(value, rneBits, roundingMode);
  }

  const rawBits = BigInt(adjustedBits);
  return {
    formatId: "FP32",
    inputValue: value,
    roundingMode,
    rawBits,
    rawBinary: formatBinary(rawBits, 32),
    rawHex: formatHex(rawBits, 32),
    notes: [],
  };
}

function roundMantissa(
  mantissa: number,
  shift: number,
  roundingMode: RoundingMode,
  sign: number,
): { mantissa: number; carry: boolean } {
  if (shift <= 0) {
    return { mantissa, carry: false };
  }

  const truncated = mantissa >> shift;
  const remainderMask = (1 << shift) - 1;
  const remainder = mantissa & remainderMask;

  let rounded = truncated;

  if (roundingMode === "RNE" && remainder !== 0) {
    const half = 1 << (shift - 1);
    const greaterThanHalf = remainder > half;
    const exactlyHalf = remainder === half;
    const lsbIsOdd = (truncated & 1) === 1;

    if (greaterThanHalf || (exactlyHalf && lsbIsOdd)) {
      rounded += 1;
    }
  } else if (roundingMode === "RTP" && sign === 0 && remainder !== 0) {
    rounded += 1;
  }

  const limit = 1 << (23 - shift);
  if (rounded >= limit) {
    return { mantissa: 0, carry: true };
  }

  return { mantissa: rounded, carry: false };
}

function float32BitsToBfloat16(bits32: number, roundingMode: RoundingMode): bigint {
  const sign = (bits32 >>> 31) & 0x1;
  const exponent = (bits32 >>> 23) & 0xff;
  const mantissa = bits32 & 0x7fffff;

  if (exponent === 0xff) {
    if (mantissa === 0) {
      return BigInt((sign << 15) | 0x7f80);
    }

    const topMantissa = mantissa >>> 16;
    const quietPayload = topMantissa === 0 ? 0x40 : topMantissa;
    return BigInt((sign << 15) | 0x7f80 | quietPayload);
  }

  const rounded = roundMantissa(mantissa, 16, roundingMode, sign);
  let nextExponent = exponent + (rounded.carry ? 1 : 0);

  if (nextExponent >= 0xff) {
    return BigInt((sign << 15) | 0x7f80);
  }

  return BigInt((sign << 15) | (nextExponent << 7) | rounded.mantissa);
}

function float32BitsToHalf(bits32: number, roundingMode: RoundingMode): bigint {
  const sign = (bits32 >>> 31) & 0x1;
  const exponent = (bits32 >>> 23) & 0xff;
  const mantissa = bits32 & 0x7fffff;
  const signHalf = sign << 15;

  if (exponent === 0xff) {
    if (mantissa === 0) {
      return BigInt(signHalf | 0x7c00);
    }

    const payload = mantissa >>> 13;
    const quietPayload = payload === 0 ? 0x0200 : payload;
    return BigInt(signHalf | 0x7c00 | quietPayload);
  }

  if (exponent === 0) {
    return BigInt(signHalf);
  }

  let halfExponent = exponent - 127 + 15;

  if (halfExponent >= 0x1f) {
    return BigInt(signHalf | 0x7c00);
  }

  if (halfExponent <= 0) {
    if (halfExponent < -10) {
      if (roundingMode === "RTP" && sign === 0) {
        return BigInt(signHalf | 0x0001);
      }

      return BigInt(signHalf);
    }

    const mantissaWithHiddenBit = mantissa | 0x800000;
    const shift = 14 - halfExponent;
    let halfMantissa = mantissaWithHiddenBit >> shift;

    if (roundingMode === "RNE") {
      const remainderMask = (1 << shift) - 1;
      const remainder = mantissaWithHiddenBit & remainderMask;
      const half = 1 << (shift - 1);
      const greaterThanHalf = remainder > half;
      const exactlyHalf = remainder === half;
      const lsbIsOdd = (halfMantissa & 1) === 1;

      if (greaterThanHalf || (exactlyHalf && lsbIsOdd)) {
        halfMantissa += 1;
      }
    } else if (roundingMode === "RTP") {
      const remainderMask = (1 << shift) - 1;
      const remainder = mantissaWithHiddenBit & remainderMask;

      if (sign === 0 && remainder !== 0) {
        halfMantissa += 1;
      }
    }

    return BigInt(signHalf | halfMantissa);
  }

  let halfMantissa = mantissa >> 13;

  if (roundingMode === "RNE") {
    const remainder = mantissa & 0x1fff;
    const greaterThanHalf = remainder > 0x1000;
    const exactlyHalf = remainder === 0x1000;
    const lsbIsOdd = (halfMantissa & 1) === 1;

    if (greaterThanHalf || (exactlyHalf && lsbIsOdd)) {
      halfMantissa += 1;
    }
  } else if (roundingMode === "RTP") {
    const remainder = mantissa & 0x1fff;

    if (sign === 0 && remainder !== 0) {
      halfMantissa += 1;
    }
  }

  if (halfMantissa === 0x400) {
    halfMantissa = 0;
    halfExponent += 1;

    if (halfExponent >= 0x1f) {
      return BigInt(signHalf | 0x7c00);
    }
  }

  return BigInt(signHalf | (halfExponent << 10) | halfMantissa);
}

function isFiniteFloatCandidate(value: DecodedValue): value is FiniteFloatCandidate {
  return (
    value.decimalValue !== null &&
    !value.isNaN &&
    !value.isInfinity
  );
}

function getFiniteFloatCandidates(format: FormatDefinition): FiniteFloatCandidate[] {
  const cached = finiteFloatCandidateCache.get(format.id);
  if (cached) {
    return cached;
  }

  const candidates: FiniteFloatCandidate[] = [];
  const limit = 1 << format.bitWidth;

  for (let raw = 0; raw < limit; raw += 1) {
    const decoded = decodeRawBits(format.id, BigInt(raw));
    if (isFiniteFloatCandidate(decoded)) {
      candidates.push(decoded);
    }
  }

  finiteFloatCandidateCache.set(format.id, candidates);
  return candidates;
}

function getSignedFiniteCandidates(
  format: FormatDefinition,
  signKind: "POS" | "NEG",
): FiniteFloatCandidate[] {
  const cacheKey = `${format.id}:${signKind}` as const;
  const cached = signedFiniteCandidateCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const candidates = getFiniteFloatCandidates(format).filter((candidate) => candidate.sign === signKind);
  signedFiniteCandidateCache.set(cacheKey, candidates);
  return candidates;
}

function getSignedZeroCandidate(
  format: FormatDefinition,
  signKind: "POS" | "NEG",
): FiniteFloatCandidate {
  const candidate = getSignedFiniteCandidates(format, signKind).find((entry) => entry.isZero);
  if (!candidate) {
    throw new Error(`${format.id}: signed zero candidate is unavailable`);
  }

  return candidate;
}

function getMaxFiniteCandidate(
  format: FormatDefinition,
  signKind: "POS" | "NEG",
): FiniteFloatCandidate {
  const cacheKey = `${format.id}:${signKind}` as const;
  const cached = maxFiniteCandidateCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const candidates = getSignedFiniteCandidates(format, signKind).filter((candidate) => !candidate.isZero);
  if (candidates.length === 0) {
    throw new Error(`${format.id}: max finite candidate is unavailable`);
  }

  const maxFiniteCandidate = candidates.reduce((best, candidate) => {
    if (signKind === "POS") {
      return candidate.decimalValue > best.decimalValue ? candidate : best;
    }

    return candidate.decimalValue < best.decimalValue ? candidate : best;
  });

  maxFiniteCandidateCache.set(cacheKey, maxFiniteCandidate);
  return maxFiniteCandidate;
}

function getOrderedFiniteCandidates(format: FormatDefinition): FiniteFloatCandidate[] {
  const cached = orderedFiniteCandidateCache.get(format.id);
  if (cached) {
    return cached;
  }

  const ordered = [...getFiniteFloatCandidates(format)].sort((left, right) => {
    if (left.decimalValue !== right.decimalValue) {
      return left.decimalValue - right.decimalValue;
    }

    if (left.rawBits < right.rawBits) {
      return -1;
    }

    if (left.rawBits > right.rawBits) {
      return 1;
    }

    return 0;
  });

  orderedFiniteCandidateCache.set(format.id, ordered);
  return ordered;
}

function getZeroFiniteCandidate(format: FormatDefinition): FiniteFloatCandidate | null {
  if (zeroFiniteCandidateCache.has(format.id)) {
    return zeroFiniteCandidateCache.get(format.id) ?? null;
  }

  const zeroCandidate = getFiniteFloatCandidates(format).find((candidate) => candidate.isZero) ?? null;
  zeroFiniteCandidateCache.set(format.id, zeroCandidate);
  return zeroCandidate;
}

function getMaxUnsignedFiniteCandidate(format: FormatDefinition): FiniteFloatCandidate {
  const cached = maxUnsignedFiniteCandidateCache.get(format.id);
  if (cached) {
    return cached;
  }

  const candidates = getFiniteFloatCandidates(format).filter((candidate) => !candidate.isZero);
  if (candidates.length === 0) {
    throw new Error(`${format.id}: unsigned finite candidates are unavailable`);
  }

  const maxFiniteCandidate = candidates.reduce((best, candidate) =>
    candidate.decimalValue > best.decimalValue ? candidate : best
  );

  maxUnsignedFiniteCandidateCache.set(format.id, maxFiniteCandidate);
  return maxFiniteCandidate;
}

function getMinPositiveFiniteCandidate(format: FormatDefinition): FiniteFloatCandidate {
  const cached = minPositiveFiniteCandidateCache.get(format.id);
  if (cached) {
    return cached;
  }

  const candidates = getFiniteFloatCandidates(format).filter((candidate) => !candidate.isZero);
  if (candidates.length === 0) {
    throw new Error(`${format.id}: minimum positive finite candidate is unavailable`);
  }

  const minPositiveCandidate = candidates.reduce((best, candidate) =>
    candidate.decimalValue < best.decimalValue ? candidate : best
  );

  minPositiveFiniteCandidateCache.set(format.id, minPositiveCandidate);
  return minPositiveCandidate;
}

function selectNearestEvenCandidate(
  candidates: readonly FiniteFloatCandidate[],
  value: number,
): FiniteFloatCandidate {
  let best = candidates[0];
  let bestDistance = Math.abs(best.decimalValue - value);

  for (const candidate of candidates.slice(1)) {
    const distance = Math.abs(candidate.decimalValue - value);
    const tolerance = Number.EPSILON * Math.max(
      Math.abs(value),
      Math.abs(distance),
      Math.abs(bestDistance),
      Number.MIN_VALUE,
    );

    if (distance < bestDistance - tolerance) {
      best = candidate;
      bestDistance = distance;
      continue;
    }

    if (Math.abs(distance - bestDistance) <= tolerance) {
      const candidateIsEven = (candidate.rawBits & 1n) === 0n;
      const bestIsEven = (best.rawBits & 1n) === 0n;

      if (candidateIsEven && !bestIsEven) {
        best = candidate;
        bestDistance = distance;
      }
    }
  }

  return best;
}

function selectRoundTowardPositiveInfinityCandidate(
  candidates: readonly FiniteFloatCandidate[],
  value: number,
): FiniteFloatCandidate {
  let best: FiniteFloatCandidate | null = null;

  for (const candidate of candidates) {
    if (candidate.decimalValue < value) {
      continue;
    }

    if (best === null || candidate.decimalValue < best.decimalValue) {
      best = candidate;
    }
  }

  if (best === null) {
    throw new Error("No representable candidate is greater than or equal to the input value");
  }

  return best;
}

function selectRoundTowardZeroCandidate(
  candidates: readonly FiniteFloatCandidate[],
  value: number,
): FiniteFloatCandidate | null {
  let best: FiniteFloatCandidate | null = null;

  for (const candidate of candidates) {
    if (candidate.decimalValue > value) {
      continue;
    }

    if (best === null || candidate.decimalValue > best.decimalValue) {
      best = candidate;
    }
  }

  return best;
}

function encodeSmallOcpFloat(format: FormatDefinition, value: number, roundingMode: RoundingMode): bigint {
  const signKind = value < 0 || Object.is(value, -0) ? "NEG" : "POS";

  if (Object.is(value, 0) || Object.is(value, -0)) {
    return getSignedZeroCandidate(format, signKind).rawBits;
  }

  if (!Number.isFinite(value)) {
    if (Number.isNaN(value)) {
      const canonicalNaNHex = getDefaultCanonicalNaNHex(format.id);
      if (!canonicalNaNHex) {
        throw new Error(`${format.id}: NaN is not representable in this format`);
      }

      return BigInt(canonicalNaNHex);
    }

    if (format.overflowBehavior === "saturate") {
      return getMaxFiniteCandidate(format, signKind).rawBits;
    }

    if (format.supportsInfinity) {
      const exponentAllOnes =
        ((1n << BigInt(format.exponentBitCount)) - 1n) << BigInt(format.mantissaBitCount);
      const signField =
        signKind === "NEG"
          ? 1n << BigInt(format.exponentBitCount + format.mantissaBitCount)
          : 0n;
      return signField | exponentAllOnes;
    }

    throw new Error(`${format.id}: infinity is not representable in this format`);
  }

  const signedCandidates = getSignedFiniteCandidates(format, signKind);
  const maxFiniteCandidate = getMaxFiniteCandidate(format, signKind);

  if (Math.abs(value) > Math.abs(maxFiniteCandidate.decimalValue)) {
    return maxFiniteCandidate.rawBits;
  }

  if (roundingMode === "RTZ") {
    let best = getSignedZeroCandidate(format, signKind);

    for (const candidate of signedCandidates) {
      if (signKind === "POS") {
        if (candidate.decimalValue <= value && candidate.decimalValue >= best.decimalValue) {
          best = candidate;
        }
      } else if (
        candidate.decimalValue >= value &&
        (best.isZero || candidate.decimalValue <= best.decimalValue)
      ) {
        best = candidate;
      }
    }

    return best.rawBits;
  }

  if (roundingMode === "RTP") {
    return selectRoundTowardPositiveInfinityCandidate(signedCandidates, value).rawBits;
  }

  return selectNearestEvenCandidate(signedCandidates, value).rawBits;
}

function encodeUnsignedFloat(format: FormatDefinition, value: number, roundingMode: RoundingMode): bigint {
  const canonicalNaNHex = getDefaultCanonicalNaNHex(format.id);
  const orderedCandidates = getOrderedFiniteCandidates(format);
  const zeroCandidate = getZeroFiniteCandidate(format);
  const minPositiveCandidate = getMinPositiveFiniteCandidate(format);
  const maxFiniteCandidate = getMaxUnsignedFiniteCandidate(format);

  if (!canonicalNaNHex && format.supportsNaN) {
    throw new Error(`${format.id}: NaN is not representable in this format`);
  }

  if (Number.isNaN(value)) {
    if (!canonicalNaNHex) {
      throw new Error(`${format.id}: NaN is not representable in this format`);
    }

    return BigInt(canonicalNaNHex);
  }

  const magnitude = Math.abs(value);

  if (!Number.isFinite(magnitude)) {
    return maxFiniteCandidate.rawBits;
  }

  if (Object.is(magnitude, 0)) {
    return zeroCandidate?.rawBits ?? minPositiveCandidate.rawBits;
  }

  if (magnitude > maxFiniteCandidate.decimalValue) {
    return maxFiniteCandidate.rawBits;
  }

  if (
    format.underflowBehavior === "saturate" &&
    magnitude < minPositiveCandidate.decimalValue
  ) {
    return minPositiveCandidate.rawBits;
  }

  if (roundingMode === "RTZ") {
    const towardZeroCandidate = selectRoundTowardZeroCandidate(orderedCandidates, magnitude);
    return towardZeroCandidate?.rawBits ?? (zeroCandidate?.rawBits ?? minPositiveCandidate.rawBits);
  }

  if (roundingMode === "RTP") {
    const towardPositiveInfinityCandidate = selectRoundTowardPositiveInfinityCandidate(
      orderedCandidates,
      magnitude,
    );
    return towardPositiveInfinityCandidate.rawBits;
  }

  return selectNearestEvenCandidate(orderedCandidates, magnitude).rawBits;
}

function getFiniteOverflowDirectedRawBits(
  format: FormatDefinition,
  value: number,
  roundingMode: RoundingMode,
): bigint | null {
  if (format.id !== "FP16" && format.id !== "BF16") {
    return null;
  }

  if (!Number.isFinite(value) || Object.is(value, 0) || Object.is(value, -0)) {
    return null;
  }

  const signKind = value < 0 || Object.is(value, -0) ? "NEG" : "POS";
  const maxFiniteCandidate = getMaxFiniteCandidate(format, signKind);

  if (Math.abs(value) > Math.abs(maxFiniteCandidate.decimalValue)) {
    if (roundingMode === "RTZ") {
      return maxFiniteCandidate.rawBits;
    }

    if (roundingMode === "RTP" && signKind === "NEG") {
      return maxFiniteCandidate.rawBits;
    }
  }

  return null;
}

export function encodeFloat(
  format: FormatDefinition,
  value: number,
  roundingMode: RoundingMode,
): EncodedValue {
  const bits32 = numberToFloat32Bits(value);
  let rawBits: bigint;

  switch (format.id) {
    case "FP32":
      return encodeFloat32(value, roundingMode);
    case "BF16": {
      const overflowDirectedRawBits = roundingMode === "RNE"
        ? null
        : getFiniteOverflowDirectedRawBits(format, value, roundingMode);
      rawBits = overflowDirectedRawBits ?? float32BitsToBfloat16(bits32, roundingMode);
      break;
    }
    case "FP16": {
      const overflowDirectedRawBits = roundingMode === "RNE"
        ? null
        : getFiniteOverflowDirectedRawBits(format, value, roundingMode);
      rawBits = overflowDirectedRawBits ?? float32BitsToHalf(bits32, roundingMode);
      break;
    }
    case "E5M2":
    case "E4M3":
    case "E2M1":
      rawBits = encodeSmallOcpFloat(format, value, roundingMode);
      break;
    case "UE8M0":
      rawBits = encodeUnsignedFloat(format, value, roundingMode);
      break;
    default:
      throw new Error(`${format.id}: float encoding not implemented`);
  }

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
