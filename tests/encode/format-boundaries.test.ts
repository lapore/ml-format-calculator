import assert from "node:assert/strict";
import test from "node:test";

import { ROUNDING_MODES, type RoundingMode } from "../../src/core/constants/rounding.js";
import { decodeRawBits } from "../../src/core/decode/index.js";
import { encodeValue } from "../../src/core/encode/index.js";
import { getFormatDefinition } from "../../src/core/formats/index.js";
import type { DecodedValue } from "../../src/core/model/decoded-value.js";

type BoundaryFormatId = "FP32" | "FP16" | "BF16" | "E5M2" | "E4M3" | "E2M1" | "UE8M0";
type FiniteDecodedValue = DecodedValue & { decimalValue: number };
type SignCase = "POS" | "NEG";

function assertFinite(decoded: DecodedValue, message: string): asserts decoded is FiniteDecodedValue {
  assert.notEqual(decoded.decimalValue, null, message);
}

function getPositiveFiniteCandidates(formatId: BoundaryFormatId): FiniteDecodedValue[] {
  const format = getFormatDefinition(formatId);
  const candidates: FiniteDecodedValue[] = [];
  const limit = 1 << format.bitWidth;

  for (let raw = 0; raw < limit; raw += 1) {
    const decoded = decodeRawBits(formatId, BigInt(raw));
    assertFinite(decoded, `${formatId} raw 0x${raw.toString(16)} should decode to a numeric value`);

    if (decoded.sign !== "POS" || decoded.isNaN || decoded.isInfinity || decoded.isZero) {
      continue;
    }

    candidates.push(decoded);
  }

  return candidates.sort((left, right) => left.decimalValue - right.decimalValue);
}

function decodeFiniteRaw(formatId: BoundaryFormatId, rawBits: bigint): FiniteDecodedValue {
  const decoded = decodeRawBits(formatId, rawBits);
  assertFinite(decoded, `${formatId} raw ${rawBits.toString(16)} should decode to a numeric value`);
  return decoded;
}

type BoundaryValues = {
  minSubnormal: FiniteDecodedValue;
  nextAfterMinSubnormal: FiniteDecodedValue;
  maxSubnormal: FiniteDecodedValue;
  minNormal: FiniteDecodedValue;
  nextAfterMinNormal: FiniteDecodedValue;
  prevMaxNormal: FiniteDecodedValue;
  maxNormal: FiniteDecodedValue;
};

const positiveBoundaryCache = new Map<BoundaryFormatId, BoundaryValues>();

function getPositiveBoundaryValues(formatId: BoundaryFormatId): BoundaryValues {
  const cached = positiveBoundaryCache.get(formatId);
  if (cached) {
    return cached;
  }

  if (formatId === "FP32") {
    const boundaryValues = {
      minSubnormal: decodeFiniteRaw(formatId, 0x00000001n),
      nextAfterMinSubnormal: decodeFiniteRaw(formatId, 0x00000002n),
      maxSubnormal: decodeFiniteRaw(formatId, 0x007fffffn),
      minNormal: decodeFiniteRaw(formatId, 0x00800000n),
      nextAfterMinNormal: decodeFiniteRaw(formatId, 0x00800001n),
      prevMaxNormal: decodeFiniteRaw(formatId, 0x7f7ffffen),
      maxNormal: decodeFiniteRaw(formatId, 0x7f7fffffn),
    };
    positiveBoundaryCache.set(formatId, boundaryValues);
    return boundaryValues;
  }

  const positiveFiniteCandidates = getPositiveFiniteCandidates(formatId);
  const subnormals = positiveFiniteCandidates.filter((candidate) => candidate.classification === "SUBNORMAL");
  const normals = positiveFiniteCandidates.filter((candidate) => candidate.classification === "NORMAL");

  const minSubnormal = subnormals[0];
  const maxSubnormal = subnormals.at(-1);
  const minNormal = normals[0];
  const nextAfterMinNormal = normals[1];
  const maxNormal = normals.at(-1);
  const prevMaxNormal = normals.at(-2);
  const nextAfterMinSubnormal = positiveFiniteCandidates[1];

  assert.ok(minSubnormal, `${formatId} should define a positive minimum subnormal`);
  assert.ok(maxSubnormal, `${formatId} should define a positive maximum subnormal`);
  assert.ok(minNormal, `${formatId} should define a positive minimum normal`);
  assert.ok(nextAfterMinNormal, `${formatId} should define a finite value above its minimum normal`);
  assert.ok(maxNormal, `${formatId} should define a positive maximum normal`);
  assert.ok(prevMaxNormal, `${formatId} should define a predecessor to its maximum normal`);
  assert.ok(nextAfterMinSubnormal, `${formatId} should define a finite value above its minimum subnormal`);

  const boundaryValues = {
    minSubnormal,
    nextAfterMinSubnormal,
    maxSubnormal,
    minNormal,
    nextAfterMinNormal,
    prevMaxNormal,
    maxNormal,
  };

  positiveBoundaryCache.set(formatId, boundaryValues);
  return boundaryValues;
}

function getSignedBoundaryValues(formatId: BoundaryFormatId, sign: SignCase): BoundaryValues {
  const positive = getPositiveBoundaryValues(formatId);

  if (sign === "POS") {
    return positive;
  }

  const format = getFormatDefinition(formatId);
  const signField = 1n << BigInt(format.exponentBitCount + format.mantissaBitCount);

  return {
    minSubnormal: decodeFiniteRaw(formatId, positive.minSubnormal.rawBits | signField),
    nextAfterMinSubnormal: decodeFiniteRaw(formatId, positive.nextAfterMinSubnormal.rawBits | signField),
    maxSubnormal: decodeFiniteRaw(formatId, positive.maxSubnormal.rawBits | signField),
    minNormal: decodeFiniteRaw(formatId, positive.minNormal.rawBits | signField),
    nextAfterMinNormal: decodeFiniteRaw(formatId, positive.nextAfterMinNormal.rawBits | signField),
    prevMaxNormal: decodeFiniteRaw(formatId, positive.prevMaxNormal.rawBits | signField),
    maxNormal: decodeFiniteRaw(formatId, positive.maxNormal.rawBits | signField),
  };
}

function decodeEncodedValue(formatId: BoundaryFormatId, value: number, roundingMode: RoundingMode): DecodedValue {
  return decodeRawBits(formatId, encodeValue(formatId, value, roundingMode).rawBits);
}

const boundaryFormats: BoundaryFormatId[] = ["FP32", "FP16", "BF16", "E5M2", "E4M3", "E2M1"];
const signCases: SignCase[] = ["POS", "NEG"];
const roundingModes: readonly RoundingMode[] = ROUNDING_MODES;

for (const formatId of boundaryFormats) {
  for (const sign of signCases) {
    for (const roundingMode of roundingModes) {
      test(`${formatId} ${sign} ${roundingMode} covers toward-zero / exact / away-from-zero around the minimum subnormal boundary`, () => {
        const { minSubnormal, nextAfterMinSubnormal } = getSignedBoundaryValues(formatId, sign);
        const signFactor = sign === "NEG" ? -1 : 1;
        const minValue = Math.abs(minSubnormal.decimalValue);
        const nextValue = Math.abs(nextAfterMinSubnormal.decimalValue);

        const towardZero = signFactor * (minValue / 4);
        const exact = minSubnormal.decimalValue;
        const awayFromZero = signFactor * ((3 * minValue + nextValue) / 4);

        const towardZeroDecoded = decodeEncodedValue(formatId, towardZero, roundingMode);
        const exactDecoded = decodeEncodedValue(formatId, exact, roundingMode);
        const awayFromZeroDecoded = decodeEncodedValue(formatId, awayFromZero, roundingMode);

        if (roundingMode === "RTP" && sign === "POS") {
          assert.equal(towardZeroDecoded.classification, "SUBNORMAL");
          assert.equal(towardZeroDecoded.rawBits, minSubnormal.rawBits);
        } else {
          assert.equal(towardZeroDecoded.classification, "ZERO");
          assert.equal(towardZeroDecoded.sign, sign);
        }

        assert.equal(exactDecoded.classification, "SUBNORMAL");
        assert.equal(exactDecoded.rawBits, minSubnormal.rawBits);
        assert.equal(
          awayFromZeroDecoded.classification,
          roundingMode === "RTP" && sign === "POS"
            ? nextAfterMinSubnormal.classification
            : "SUBNORMAL",
        );
        assert.equal(
          awayFromZeroDecoded.rawBits,
          roundingMode === "RTP" && sign === "POS"
            ? nextAfterMinSubnormal.rawBits
            : minSubnormal.rawBits,
        );
      });

      test(`${formatId} ${sign} ${roundingMode} covers toward-zero / exact / away-from-zero around the MAX_SUBNORMAL to MIN_NORMAL transition`, () => {
        const { maxSubnormal, minNormal, nextAfterMinNormal } = getSignedBoundaryValues(formatId, sign);
        const signFactor = sign === "NEG" ? -1 : 1;
        const maxSubValue = Math.abs(maxSubnormal.decimalValue);
        const minNormalValue = Math.abs(minNormal.decimalValue);
        const nextNormalValue = Math.abs(nextAfterMinNormal.decimalValue);

        const towardZero = signFactor * ((3 * maxSubValue + minNormalValue) / 4);
        const exact = minNormal.decimalValue;
        const awayFromZero = signFactor * ((3 * minNormalValue + nextNormalValue) / 4);

        const towardZeroDecoded = decodeEncodedValue(formatId, towardZero, roundingMode);
        const exactDecoded = decodeEncodedValue(formatId, exact, roundingMode);
        const awayFromZeroDecoded = decodeEncodedValue(formatId, awayFromZero, roundingMode);

        assert.equal(
          towardZeroDecoded.classification,
          roundingMode === "RTP" && sign === "POS"
            ? "NORMAL"
            : "SUBNORMAL",
        );
        assert.equal(
          towardZeroDecoded.rawBits,
          roundingMode === "RTP" && sign === "POS"
            ? minNormal.rawBits
            : maxSubnormal.rawBits,
        );
        assert.equal(exactDecoded.classification, "NORMAL");
        assert.equal(exactDecoded.rawBits, minNormal.rawBits);
        assert.equal(awayFromZeroDecoded.classification, "NORMAL");
        assert.equal(
          awayFromZeroDecoded.rawBits,
          roundingMode === "RTP" && sign === "POS"
            ? nextAfterMinNormal.rawBits
            : minNormal.rawBits,
        );
      });

      test(`${formatId} ${sign} ${roundingMode} covers toward-zero / exact / overflow behavior around the maximum normal boundary`, () => {
        const { prevMaxNormal, maxNormal } = getSignedBoundaryValues(formatId, sign);
        const signFactor = sign === "NEG" ? -1 : 1;
        const format = getFormatDefinition(formatId);
        const prevMaxValue = Math.abs(prevMaxNormal.decimalValue);
        const maxValue = Math.abs(maxNormal.decimalValue);

        const towardZero = signFactor * ((prevMaxValue + 3 * maxValue) / 4);
        const exact = maxNormal.decimalValue;
        const overflow = signFactor * (maxValue * 2);

        const towardZeroDecoded = decodeEncodedValue(formatId, towardZero, roundingMode);
        const exactDecoded = decodeEncodedValue(formatId, exact, roundingMode);
        const overflowDecoded = decodeEncodedValue(formatId, overflow, roundingMode);

        assert.equal(towardZeroDecoded.classification, "NORMAL");
        assert.equal(
          towardZeroDecoded.rawBits,
          roundingMode === "RNE" || (roundingMode === "RTP" && sign === "POS")
            ? maxNormal.rawBits
            : prevMaxNormal.rawBits,
        );
        assert.equal(exactDecoded.classification, "NORMAL");
        assert.equal(exactDecoded.rawBits, maxNormal.rawBits);

        if (
          format.supportsInfinity &&
          format.overflowBehavior === "infinity" &&
          (roundingMode === "RNE" || (roundingMode === "RTP" && sign === "POS"))
        ) {
          assert.equal(overflowDecoded.classification, "INF");
          assert.equal(overflowDecoded.sign, sign);
          return;
        }

        assert.equal(overflowDecoded.classification, "NORMAL");
        assert.equal(overflowDecoded.rawBits, maxNormal.rawBits);
      });
    }
  }
}

function decodeUnsignedValue(formatId: "UE8M0", rawBits: bigint): FiniteDecodedValue {
  const decoded = decodeRawBits(formatId, rawBits);
  assertFinite(decoded, `${formatId} raw ${rawBits.toString(16)} should decode to a numeric value`);
  return decoded;
}

const ue8m0MinNormal = decodeUnsignedValue("UE8M0", 0x00n);
const ue8m0NextAfterMinNormal = decodeUnsignedValue("UE8M0", 0x01n);
const ue8m0PrevMaxNormal = decodeUnsignedValue("UE8M0", 0xfdn);
const ue8m0MaxNormal = decodeUnsignedValue("UE8M0", 0xfen);

for (const roundingMode of roundingModes) {
  test(`UE8M0 ${roundingMode} covers smaller / exact / larger values around the minimum normal boundary`, () => {
    const belowMinimum = ue8m0MinNormal.decimalValue / 4;
    const exact = ue8m0MinNormal.decimalValue;
    const aboveMinimum = (3 * ue8m0MinNormal.decimalValue + ue8m0NextAfterMinNormal.decimalValue) / 4;

    const belowMinimumDecoded = decodeEncodedValue("UE8M0", belowMinimum, roundingMode);
    const exactDecoded = decodeEncodedValue("UE8M0", exact, roundingMode);
    const aboveMinimumDecoded = decodeEncodedValue("UE8M0", aboveMinimum, roundingMode);

    assert.equal(belowMinimumDecoded.rawBits, ue8m0MinNormal.rawBits);
    assert.equal(exactDecoded.rawBits, ue8m0MinNormal.rawBits);
    assert.equal(
      aboveMinimumDecoded.rawBits,
      roundingMode === "RTP" ? ue8m0NextAfterMinNormal.rawBits : ue8m0MinNormal.rawBits,
    );
  });

  test(`UE8M0 ${roundingMode} covers smaller / exact / overflow values around the maximum normal boundary`, () => {
    const towardZero = (ue8m0PrevMaxNormal.decimalValue + 3 * ue8m0MaxNormal.decimalValue) / 4;
    const exact = ue8m0MaxNormal.decimalValue;
    const overflow = ue8m0MaxNormal.decimalValue * 2;

    const towardZeroDecoded = decodeEncodedValue("UE8M0", towardZero, roundingMode);
    const exactDecoded = decodeEncodedValue("UE8M0", exact, roundingMode);
    const overflowDecoded = decodeEncodedValue("UE8M0", overflow, roundingMode);

    assert.equal(
      towardZeroDecoded.rawBits,
      roundingMode === "RTZ" ? ue8m0PrevMaxNormal.rawBits : ue8m0MaxNormal.rawBits,
    );
    assert.equal(exactDecoded.rawBits, ue8m0MaxNormal.rawBits);
    assert.equal(overflowDecoded.rawBits, ue8m0MaxNormal.rawBits);
  });
}
