import test from "node:test";
import assert from "node:assert/strict";

import { encodeValue } from "../../src/core/encode/index.js";

test("fp32 encodes 6.5", () => {
  const encoded = encodeValue("FP32", 6.5, "RNE");
  assert.equal(encoded.rawBits, 0x40d00000n);
});

test("fp32 encodes negative zero", () => {
  const encoded = encodeValue("FP32", -0, "RNE");
  assert.equal(encoded.rawBits, 0x80000000n);
});

test("fp32 encodes positive infinity", () => {
  const encoded = encodeValue("FP32", Number.POSITIVE_INFINITY, "RNE");
  assert.equal(encoded.rawBits, 0x7f800000n);
});

test("fp32 encodes negative infinity", () => {
  const encoded = encodeValue("FP32", Number.NEGATIVE_INFINITY, "RNE");
  assert.equal(encoded.rawBits, 0xff800000n);
});

test("fp32 encodes NaN as quiet NaN payload", () => {
  const encoded = encodeValue("FP32", Number.NaN, "RNE");
  assert.equal(encoded.rawBits, 0x7fc00000n);
});

test("fp16 encodes 1.0", () => {
  const encoded = encodeValue("FP16", 1, "RNE");
  assert.equal(encoded.rawBits, 0x3c00n);
});

test("fp16 encodes 6.5", () => {
  const encoded = encodeValue("FP16", 6.5, "RNE");
  assert.equal(encoded.rawBits, 0x4680n);
});

test("fp16 rounds overflow to infinity", () => {
  const encoded = encodeValue("FP16", 1e10, "RNE");
  assert.equal(encoded.rawBits, 0x7c00n);
});

test("fp16 encodes negative zero", () => {
  const encoded = encodeValue("FP16", -0, "RNE");
  assert.equal(encoded.rawBits, 0x8000n);
});

test("fp16 encodes negative infinity", () => {
  const encoded = encodeValue("FP16", Number.NEGATIVE_INFINITY, "RNE");
  assert.equal(encoded.rawBits, 0xfc00n);
});

test("fp16 encodes NaN as quiet NaN payload", () => {
  const encoded = encodeValue("FP16", Number.NaN, "RNE");
  assert.equal(encoded.rawBits, 0x7e00n);
});

test("bf16 encodes 1.0", () => {
  const encoded = encodeValue("BF16", 1, "RNE");
  assert.equal(encoded.rawBits, 0x3f80n);
});

test("bf16 uses round-to-nearest-even", () => {
  const rne = encodeValue("BF16", 1.00390625, "RNE");
  const rtz = encodeValue("BF16", 1.00390625, "RTZ");

  assert.equal(rne.rawBits, 0x3f80n);
  assert.equal(rtz.rawBits, 0x3f80n);
});

test("bf16 distinguishes RNE and RTZ on non-tie values", () => {
  const rne = encodeValue("BF16", 1.006, "RNE");
  const rtz = encodeValue("BF16", 1.006, "RTZ");

  assert.equal(rne.rawBits, 0x3f81n);
  assert.equal(rtz.rawBits, 0x3f80n);
});

test("bf16 encodes negative infinity", () => {
  const encoded = encodeValue("BF16", Number.NEGATIVE_INFINITY, "RNE");
  assert.equal(encoded.rawBits, 0xff80n);
});

test("bf16 encodes NaN as quiet NaN payload", () => {
  const encoded = encodeValue("BF16", Number.NaN, "RNE");
  assert.equal(encoded.rawBits, 0x7fc0n);
});

test("int32 encodes positive integer", () => {
  const encoded = encodeValue("INT32", 42, "RNE");
  assert.equal(encoded.rawBits, 0x2an);
});

test("int32 encodes -1", () => {
  const encoded = encodeValue("INT32", -1, "RNE");
  assert.equal(encoded.rawBits, 0xffffffffn);
});

test("int32 RNE rounds ties to even", () => {
  const encoded = encodeValue("INT32", 2.5, "RNE");
  assert.equal(encoded.rawBits, 0x2n);
});

test("int32 RNE rounds negative ties to even", () => {
  const encoded = encodeValue("INT32", -2.5, "RNE");
  assert.equal(encoded.rawBits, 0xfffffffen);
});

test("int32 RTZ rounds toward zero", () => {
  const encoded = encodeValue("INT32", -2.9, "RTZ");
  assert.equal(encoded.rawBits, 0xfffffffen);
});

test("int32 rejects positive overflow", () => {
  assert.throws(() => encodeValue("INT32", 2147483648, "RNE"));
});

test("int32 rejects negative overflow", () => {
  assert.throws(() => encodeValue("INT32", -2147483649, "RNE"));
});

test("int32 rejects infinity", () => {
  assert.throws(() => encodeValue("INT32", Number.POSITIVE_INFINITY, "RNE"));
});
