import test from "node:test";
import assert from "node:assert/strict";

import { FORMAT_IDS } from "../../src/core/constants/format-id.js";
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

test("placeholder formats are marked with notes and no IEEE assumptions", () => {
  for (const id of ["E4M3", "E2M1", "E5M2"] as const) {
    const format = getFormatDefinition(id);
    assert.ok(format.notes && format.notes.includes("Placeholder"));
    assert.equal(format.exponentBias, null);
  }
});
