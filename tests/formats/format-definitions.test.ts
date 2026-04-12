import test from "node:test";
import assert from "node:assert/strict";

import { FORMAT_IDS } from "../../src/core/constants/format-id.js";
import { ROUNDING_MODES } from "../../src/core/constants/rounding.js";
import { formats, getFormatDefinition } from "../../src/core/formats/index.js";
import { validateFormatDefinition } from "../../src/core/model/format-definition.js";

test("every format id has a registry entry", () => {
  assert.equal(formats.length, FORMAT_IDS.length);

  for (const id of FORMAT_IDS) {
    assert.ok(getFormatDefinition(id), `missing registry entry for ${id}`);
  }
});

test("all format ids are unique", () => {
  const ids = formats.map((format) => format.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("every format definition validates", () => {
  for (const format of formats) {
    assert.doesNotThrow(() => validateFormatDefinition(format), format.id);
  }
});

test("every format exposes the shared rounding mode set", () => {
  for (const format of formats) {
    assert.deepEqual(format.roundingModes, ROUNDING_MODES, format.id);
  }
});

test("fp32 metadata matches IEEE binary32", () => {
  const format = getFormatDefinition("FP32");

  assert.equal(format.bitWidth, 32);
  assert.equal(format.signBitCount, 1);
  assert.equal(format.exponentBitCount, 8);
  assert.equal(format.mantissaBitCount, 23);
  assert.equal(format.exponentBias, 127);
  assert.equal(format.supportsSignedZero, true);
  assert.equal(format.supportsSubnormal, true);
  assert.equal(format.supportsInfinity, true);
  assert.equal(format.supportsNaN, true);
  assert.deepEqual(format.supportedClassifications, [
    "ZERO",
    "SUBNORMAL",
    "NORMAL",
    "INF",
    "NAN",
  ]);
});

test("fp16 metadata matches IEEE binary16", () => {
  const format = getFormatDefinition("FP16");

  assert.equal(format.bitWidth, 16);
  assert.equal(format.signBitCount, 1);
  assert.equal(format.exponentBitCount, 5);
  assert.equal(format.mantissaBitCount, 10);
  assert.equal(format.exponentBias, 15);
  assert.equal(format.supportsSignedZero, true);
  assert.equal(format.supportsSubnormal, true);
  assert.equal(format.supportsInfinity, true);
  assert.equal(format.supportsNaN, true);
});

test("bf16 metadata matches expected bfloat16 layout", () => {
  const format = getFormatDefinition("BF16");

  assert.equal(format.bitWidth, 16);
  assert.equal(format.signBitCount, 1);
  assert.equal(format.exponentBitCount, 8);
  assert.equal(format.mantissaBitCount, 7);
  assert.equal(format.exponentBias, 127);
  assert.equal(format.supportsSignedZero, true);
  assert.equal(format.supportsSubnormal, true);
  assert.equal(format.supportsInfinity, true);
  assert.equal(format.supportsNaN, true);
  assert.match(format.notes ?? "", /Brain floating point/);
  assert.deepEqual(format.namedBoundaries, [
    "MIN_SUBNORMAL",
    "MAX_SUBNORMAL",
    "MIN_NORMAL",
    "MAX_NORMAL",
  ]);
});

test("e5m2 metadata matches the OCP FP8 E5M2 profile", () => {
  const format = getFormatDefinition("E5M2");

  assert.equal(format.bitWidth, 8);
  assert.equal(format.signBitCount, 1);
  assert.equal(format.exponentBitCount, 5);
  assert.equal(format.mantissaBitCount, 2);
  assert.equal(format.exponentBias, 15);
  assert.equal(format.supportsSignedZero, true);
  assert.equal(format.supportsSubnormal, true);
  assert.equal(format.supportsInfinity, true);
  assert.equal(format.supportsNaN, true);
  assert.equal(format.supportsQNaN, false);
  assert.equal(format.supportsSNaN, false);
  assert.equal(format.overflowBehavior, "saturate");
  assert.deepEqual(format.namedBoundaries, [
    "MIN_SUBNORMAL",
    "MAX_SUBNORMAL",
    "MIN_NORMAL",
    "MAX_NORMAL",
  ]);
});

test("e4m3 metadata matches the OCP FP8 E4M3 profile", () => {
  const format = getFormatDefinition("E4M3");

  assert.equal(format.bitWidth, 8);
  assert.equal(format.signBitCount, 1);
  assert.equal(format.exponentBitCount, 4);
  assert.equal(format.mantissaBitCount, 3);
  assert.equal(format.exponentBias, 7);
  assert.equal(format.supportsSignedZero, true);
  assert.equal(format.supportsSubnormal, true);
  assert.equal(format.supportsInfinity, false);
  assert.equal(format.supportsNaN, true);
  assert.equal(format.supportsQNaN, false);
  assert.equal(format.supportsSNaN, false);
  assert.equal(format.overflowBehavior, "saturate");
  assert.deepEqual(format.namedBoundaries, [
    "MIN_SUBNORMAL",
    "MAX_SUBNORMAL",
    "MIN_NORMAL",
    "MAX_NORMAL",
  ]);
});

test("e2m1 metadata matches the OCP MX FP4 E2M1 profile", () => {
  const format = getFormatDefinition("E2M1");

  assert.equal(format.bitWidth, 4);
  assert.equal(format.signBitCount, 1);
  assert.equal(format.exponentBitCount, 2);
  assert.equal(format.mantissaBitCount, 1);
  assert.equal(format.exponentBias, 1);
  assert.equal(format.supportsSignedZero, true);
  assert.equal(format.supportsSubnormal, true);
  assert.equal(format.supportsInfinity, false);
  assert.equal(format.supportsNaN, false);
  assert.equal(format.overflowBehavior, "saturate");
  assert.deepEqual(format.namedBoundaries, [
    "MIN_SUBNORMAL",
    "MAX_SUBNORMAL",
    "MIN_NORMAL",
    "MAX_NORMAL",
  ]);
});

test("ue8m0 metadata matches the OCP MX E8M0 scale profile", () => {
  const format = getFormatDefinition("UE8M0");

  assert.equal(format.bitWidth, 8);
  assert.equal(format.hasSignBit, false);
  assert.equal(format.signBitCount, 0);
  assert.equal(format.exponentBitCount, 8);
  assert.equal(format.mantissaBitCount, 0);
  assert.equal(format.exponentBias, 127);
  assert.equal(format.supportsZero, false);
  assert.equal(format.supportsSignedZero, false);
  assert.equal(format.supportsSubnormal, false);
  assert.equal(format.supportsInfinity, false);
  assert.equal(format.supportsNaN, true);
  assert.equal(format.overflowBehavior, "saturate");
  assert.equal(format.underflowBehavior, "saturate");
  assert.deepEqual(format.namedBoundaries, ["MIN_NORMAL", "MAX_NORMAL"]);
});

test("int32 metadata is integer-specific", () => {
  const format = getFormatDefinition("INT32");

  assert.equal(format.kind, "integer");
  assert.equal(format.bitWidth, 32);
  assert.equal(format.signBitCount, 1);
  assert.equal(format.exponentBitCount, 0);
  assert.equal(format.mantissaBitCount, 0);
  assert.equal(format.exponentBias, null);
  assert.equal(format.supportsSignedZero, false);
  assert.equal(format.supportsSubnormal, false);
  assert.equal(format.supportsInfinity, false);
  assert.equal(format.supportsNaN, false);
  assert.deepEqual(format.supportedClassifications, ["ZERO", "INTEGER"]);
});

test("IEEE-style formats declare required named boundaries", () => {
  for (const id of ["FP32", "FP16", "BF16"] as const) {
    const format = getFormatDefinition(id);
    assert.deepEqual(format.namedBoundaries, [
      "MIN_SUBNORMAL",
      "MAX_SUBNORMAL",
      "MIN_NORMAL",
      "MAX_NORMAL",
    ]);
  }
});

test("OCP formats declare required named boundaries", () => {
  for (const id of ["E5M2", "E4M3", "E2M1"] as const) {
    const format = getFormatDefinition(id);
    assert.deepEqual(format.namedBoundaries, [
      "MIN_SUBNORMAL",
      "MAX_SUBNORMAL",
      "MIN_NORMAL",
      "MAX_NORMAL",
    ]);
    assert.match(format.notes ?? "", /OCP/);
  }
});

test("unsigned scale formats declare their required named boundaries", () => {
  const ue8m0 = getFormatDefinition("UE8M0");
  assert.deepEqual(ue8m0.namedBoundaries, ["MIN_NORMAL", "MAX_NORMAL"]);
  assert.match(ue8m0.notes ?? "", /OCP MX E8M0/);
});
