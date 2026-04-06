import test from "node:test";
import assert from "node:assert/strict";

import { decodeRawBits } from "../../src/core/decode/index.js";

test("fp32 decodes positive zero", () => {
  const decoded = decodeRawBits("FP32", 0x00000000n);

  assert.equal(decoded.classification, "ZERO");
  assert.equal(decoded.sign, "POS");
  assert.equal(decoded.decimalValueText, "0");
  assert.equal(decoded.storedBiasedExponent, 0);
});

test("fp32 decodes negative zero", () => {
  const decoded = decodeRawBits("FP32", 0x80000000n);

  assert.equal(decoded.classification, "ZERO");
  assert.equal(decoded.sign, "NEG");
  assert.equal(decoded.decimalValueText, "-0");
});

test("fp32 decodes minimum positive subnormal", () => {
  const decoded = decodeRawBits("FP32", 0x00000001n);

  assert.equal(decoded.classification, "SUBNORMAL");
  assert.equal(decoded.sign, "POS");
  assert.equal(decoded.actualExponent, -126);
  assert.equal(decoded.storedBiasedExponent, 0);
});

test("fp32 decodes minimum positive normal", () => {
  const decoded = decodeRawBits("FP32", 0x00800000n);

  assert.equal(decoded.classification, "NORMAL");
  assert.equal(decoded.actualExponent, -126);
  assert.equal(decoded.decimalValueText, String(2 ** -126));
});

test("fp32 decodes 6.5 as a normal value", () => {
  const decoded = decodeRawBits("FP32", 0x40d00000n);

  assert.equal(decoded.classification, "NORMAL");
  assert.equal(decoded.sign, "POS");
  assert.equal(decoded.storedBiasedExponent, 129);
  assert.equal(decoded.actualExponent, 2);
  assert.equal(decoded.decimalValue, 6.5);
});

test("fp32 decodes positive infinity", () => {
  const decoded = decodeRawBits("FP32", 0x7f800000n);

  assert.equal(decoded.classification, "INF");
  assert.equal(decoded.sign, "POS");
  assert.equal(decoded.decimalValueText, "+inf");
});

test("fp32 decodes negative infinity", () => {
  const decoded = decodeRawBits("FP32", 0xff800000n);

  assert.equal(decoded.classification, "INF");
  assert.equal(decoded.sign, "NEG");
  assert.equal(decoded.decimalValueText, "-inf");
});

test("fp32 decodes quiet NaN", () => {
  const decoded = decodeRawBits("FP32", 0x7fc00000n);

  assert.equal(decoded.classification, "NAN");
  assert.equal(decoded.nanKind, "quiet");
  assert.equal(decoded.decimalValueText, "qNaN");
});

test("fp32 decodes signaling NaN", () => {
  const decoded = decodeRawBits("FP32", 0x7fa00000n);

  assert.equal(decoded.classification, "NAN");
  assert.equal(decoded.nanKind, "signaling");
  assert.equal(decoded.decimalValueText, "sNaN");
});

test("fp32 decodes maximum normal", () => {
  const decoded = decodeRawBits("FP32", 0x7f7fffffn);

  assert.equal(decoded.classification, "NORMAL");
  assert.equal(decoded.actualExponent, 127);
});

test("fp32 decodes maximum subnormal", () => {
  const decoded = decodeRawBits("FP32", 0x007fffffn);

  assert.equal(decoded.classification, "SUBNORMAL");
  assert.equal(decoded.actualExponent, -126);
});

test("fp16 decodes minimum positive subnormal", () => {
  const decoded = decodeRawBits("FP16", 0x0001n);

  assert.equal(decoded.classification, "SUBNORMAL");
  assert.equal(decoded.actualExponent, -14);
  assert.equal(decoded.rawHex, "0x0001");
});

test("fp16 decodes positive infinity", () => {
  const decoded = decodeRawBits("FP16", 0x7c00n);

  assert.equal(decoded.classification, "INF");
  assert.equal(decoded.decimalValueText, "+inf");
});

test("fp16 decodes negative infinity", () => {
  const decoded = decodeRawBits("FP16", 0xfc00n);

  assert.equal(decoded.classification, "INF");
  assert.equal(decoded.decimalValueText, "-inf");
});

test("fp16 decodes quiet NaN", () => {
  const decoded = decodeRawBits("FP16", 0x7e00n);

  assert.equal(decoded.classification, "NAN");
  assert.equal(decoded.nanKind, "quiet");
});

test("fp16 decodes signaling NaN", () => {
  const decoded = decodeRawBits("FP16", 0x7d00n);

  assert.equal(decoded.classification, "NAN");
  assert.equal(decoded.nanKind, "signaling");
});

test("bf16 decodes quiet NaN", () => {
  const decoded = decodeRawBits("BF16", 0x7fc1n);

  assert.equal(decoded.classification, "NAN");
  assert.equal(decoded.nanKind, "quiet");
});

test("bf16 decodes signaling NaN", () => {
  const decoded = decodeRawBits("BF16", 0x7f81n);

  assert.equal(decoded.classification, "NAN");
  assert.equal(decoded.nanKind, "signaling");
});

test("bf16 decodes 1.0", () => {
  const decoded = decodeRawBits("BF16", 0x3f80n);

  assert.equal(decoded.classification, "NORMAL");
  assert.equal(decoded.actualExponent, 0);
  assert.equal(decoded.decimalValue, 1);
});

test("bf16 decodes minimum positive subnormal", () => {
  const decoded = decodeRawBits("BF16", 0x0001n);

  assert.equal(decoded.classification, "SUBNORMAL");
  assert.equal(decoded.actualExponent, -126);
  assert.equal(decoded.rawHex, "0x0001");
});

test("bf16 decodes maximum subnormal", () => {
  const decoded = decodeRawBits("BF16", 0x007fn);

  assert.equal(decoded.classification, "SUBNORMAL");
  assert.equal(decoded.actualExponent, -126);
});

test("bf16 decodes minimum positive normal", () => {
  const decoded = decodeRawBits("BF16", 0x0080n);

  assert.equal(decoded.classification, "NORMAL");
  assert.equal(decoded.actualExponent, -126);
});

test("bf16 decodes maximum normal", () => {
  const decoded = decodeRawBits("BF16", 0x7f7fn);

  assert.equal(decoded.classification, "NORMAL");
  assert.equal(decoded.actualExponent, 127);
});

test("bf16 decodes negative zero", () => {
  const decoded = decodeRawBits("BF16", 0x8000n);

  assert.equal(decoded.classification, "ZERO");
  assert.equal(decoded.sign, "NEG");
  assert.equal(decoded.decimalValueText, "-0");
});

test("bf16 decodes positive infinity", () => {
  const decoded = decodeRawBits("BF16", 0x7f80n);

  assert.equal(decoded.classification, "INF");
  assert.equal(decoded.decimalValueText, "+inf");
});

test("bf16 decodes negative infinity", () => {
  const decoded = decodeRawBits("BF16", 0xff80n);

  assert.equal(decoded.classification, "INF");
  assert.equal(decoded.decimalValueText, "-inf");
});

test("int32 decodes zero", () => {
  const decoded = decodeRawBits("INT32", 0x00000000n);

  assert.equal(decoded.classification, "ZERO");
  assert.equal(decoded.sign, "NONE");
  assert.equal(decoded.decimalValueText, "0");
});

test("int32 decodes positive integer", () => {
  const decoded = decodeRawBits("INT32", 0x0000002an);

  assert.equal(decoded.classification, "INTEGER");
  assert.equal(decoded.sign, "POS");
  assert.equal(decoded.decimalValueText, "42");
});

test("int32 decodes negative integer", () => {
  const decoded = decodeRawBits("INT32", 0xffffffffn);

  assert.equal(decoded.classification, "INTEGER");
  assert.equal(decoded.sign, "NEG");
  assert.equal(decoded.decimalValueText, "-1");
});

test("int32 decodes minimum value", () => {
  const decoded = decodeRawBits("INT32", 0x80000000n);

  assert.equal(decoded.classification, "INTEGER");
  assert.equal(decoded.sign, "NEG");
  assert.equal(decoded.decimalValueText, "-2147483648");
});

test("int32 decodes maximum value", () => {
  const decoded = decodeRawBits("INT32", 0x7fffffffn);

  assert.equal(decoded.classification, "INTEGER");
  assert.equal(decoded.sign, "POS");
  assert.equal(decoded.decimalValueText, "2147483647");
});
