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

test("e5m2 decodes minimum positive subnormal", () => {
  const decoded = decodeRawBits("E5M2", 0x01n);

  assert.equal(decoded.classification, "SUBNORMAL");
  assert.equal(decoded.actualExponent, -14);
  assert.equal(decoded.decimalValueText, String(2 ** -16));
});

test("e5m2 decodes maximum subnormal", () => {
  const decoded = decodeRawBits("E5M2", 0x03n);

  assert.equal(decoded.classification, "SUBNORMAL");
  assert.equal(decoded.actualExponent, -14);
  assert.equal(decoded.decimalValueText, String(0.75 * 2 ** -14));
});

test("e5m2 decodes minimum positive normal", () => {
  const decoded = decodeRawBits("E5M2", 0x04n);

  assert.equal(decoded.classification, "NORMAL");
  assert.equal(decoded.actualExponent, -14);
  assert.equal(decoded.decimalValueText, String(2 ** -14));
});

test("e5m2 decodes positive infinity", () => {
  const decoded = decodeRawBits("E5M2", 0x7cn);

  assert.equal(decoded.classification, "INF");
  assert.equal(decoded.decimalValueText, "+inf");
});

test("e5m2 decodes NaN without quiet/signaling distinction", () => {
  const decoded = decodeRawBits("E5M2", 0x7dn);

  assert.equal(decoded.classification, "NAN");
  assert.equal(decoded.nanKind, null);
  assert.equal(decoded.decimalValueText, "NaN");
});

test("e5m2 decodes maximum normal", () => {
  const decoded = decodeRawBits("E5M2", 0x7bn);

  assert.equal(decoded.classification, "NORMAL");
  assert.equal(decoded.actualExponent, 15);
  assert.equal(decoded.decimalValue, 57344);
});

test("e4m3 decodes minimum positive subnormal", () => {
  const decoded = decodeRawBits("E4M3", 0x01n);

  assert.equal(decoded.classification, "SUBNORMAL");
  assert.equal(decoded.actualExponent, -6);
  assert.equal(decoded.decimalValueText, String(2 ** -9));
});

test("e4m3 decodes maximum subnormal", () => {
  const decoded = decodeRawBits("E4M3", 0x07n);

  assert.equal(decoded.classification, "SUBNORMAL");
  assert.equal(decoded.actualExponent, -6);
  assert.equal(decoded.decimalValueText, String(0.875 * 2 ** -6));
});

test("e4m3 decodes minimum positive normal", () => {
  const decoded = decodeRawBits("E4M3", 0x08n);

  assert.equal(decoded.classification, "NORMAL");
  assert.equal(decoded.actualExponent, -6);
  assert.equal(decoded.decimalValueText, String(2 ** -6));
});

test("e4m3 decodes all-ones exponent finite values as normal except for the NaN pattern", () => {
  const decoded = decodeRawBits("E4M3", 0x78n);

  assert.equal(decoded.classification, "NORMAL");
  assert.equal(decoded.actualExponent, 8);
  assert.equal(decoded.decimalValue, 256);
});

test("e4m3 decodes NaN from the single reserved all-ones pattern", () => {
  const decoded = decodeRawBits("E4M3", 0x7fn);

  assert.equal(decoded.classification, "NAN");
  assert.equal(decoded.nanKind, null);
  assert.equal(decoded.decimalValueText, "NaN");
});

test("e4m3 decodes maximum normal", () => {
  const decoded = decodeRawBits("E4M3", 0x7en);

  assert.equal(decoded.classification, "NORMAL");
  assert.equal(decoded.actualExponent, 8);
  assert.equal(decoded.decimalValue, 448);
});

test("e2m1 decodes negative zero", () => {
  const decoded = decodeRawBits("E2M1", 0x8n);

  assert.equal(decoded.classification, "ZERO");
  assert.equal(decoded.sign, "NEG");
  assert.equal(decoded.decimalValueText, "-0");
});

test("e2m1 decodes the only positive subnormal", () => {
  const decoded = decodeRawBits("E2M1", 0x1n);

  assert.equal(decoded.classification, "SUBNORMAL");
  assert.equal(decoded.actualExponent, 0);
  assert.equal(decoded.decimalValue, 0.5);
});

test("e2m1 decodes minimum positive normal", () => {
  const decoded = decodeRawBits("E2M1", 0x2n);

  assert.equal(decoded.classification, "NORMAL");
  assert.equal(decoded.actualExponent, 0);
  assert.equal(decoded.decimalValue, 1);
});

test("e2m1 decodes maximum normal", () => {
  const decoded = decodeRawBits("E2M1", 0x7n);

  assert.equal(decoded.classification, "NORMAL");
  assert.equal(decoded.actualExponent, 2);
  assert.equal(decoded.decimalValue, 6);
});

test("ue8m0 decodes minimum normal", () => {
  const decoded = decodeRawBits("UE8M0", 0x00n);

  assert.equal(decoded.classification, "NORMAL");
  assert.equal(decoded.sign, "NONE");
  assert.equal(decoded.storedBiasedExponent, 0);
  assert.equal(decoded.actualExponent, -127);
  assert.equal(decoded.decimalValue, 2 ** -127);
});

test("ue8m0 decodes 1.0", () => {
  const decoded = decodeRawBits("UE8M0", 0x7fn);

  assert.equal(decoded.classification, "NORMAL");
  assert.equal(decoded.actualExponent, 0);
  assert.equal(decoded.decimalValue, 1);
});

test("ue8m0 decodes 2.0", () => {
  const decoded = decodeRawBits("UE8M0", 0x80n);

  assert.equal(decoded.classification, "NORMAL");
  assert.equal(decoded.actualExponent, 1);
  assert.equal(decoded.decimalValue, 2);
});

test("ue8m0 decodes maximum normal", () => {
  const decoded = decodeRawBits("UE8M0", 0xfen);

  assert.equal(decoded.classification, "NORMAL");
  assert.equal(decoded.actualExponent, 127);
  assert.equal(decoded.decimalValue, 2 ** 127);
});

test("ue8m0 decodes NaN using the reserved all-ones encoding", () => {
  const decoded = decodeRawBits("UE8M0", 0xffn);

  assert.equal(decoded.classification, "NAN");
  assert.equal(decoded.nanKind, null);
  assert.equal(decoded.sign, "NONE");
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
