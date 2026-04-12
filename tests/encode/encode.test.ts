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

test("fp32 RTZ rounds a tiny positive value down to zero when RNE would produce a subnormal", () => {
  const minSubnormal = 2 ** -149;
  const rne = encodeValue("FP32", 0.75 * minSubnormal, "RNE");
  const rtz = encodeValue("FP32", 0.75 * minSubnormal, "RTZ");

  assert.equal(rne.rawBits, 0x00000001n);
  assert.equal(rtz.rawBits, 0x00000000n);
});

test("fp32 RTZ rounds a tiny negative value up to negative zero when RNE would produce a subnormal", () => {
  const minSubnormal = 2 ** -149;
  const rne = encodeValue("FP32", -0.75 * minSubnormal, "RNE");
  const rtz = encodeValue("FP32", -0.75 * minSubnormal, "RTZ");

  assert.equal(rne.rawBits, 0x80000001n);
  assert.equal(rtz.rawBits, 0x80000000n);
});

test("fp32 RTZ overflows finite values to the maximum finite magnitude instead of infinity", () => {
  const rne = encodeValue("FP32", Number.MAX_VALUE, "RNE");
  const rtz = encodeValue("FP32", Number.MAX_VALUE, "RTZ");

  assert.equal(rne.rawBits, 0x7f800000n);
  assert.equal(rtz.rawBits, 0x7f7fffffn);
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

test("fp16 RTZ overflows finite values to the maximum finite magnitude", () => {
  const encoded = encodeValue("FP16", 1e10, "RTZ");
  assert.equal(encoded.rawBits, 0x7bffn);
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

test("bf16 RTZ overflows finite values to the maximum finite magnitude", () => {
  const encoded = encodeValue("BF16", Number.MAX_VALUE, "RTZ");
  assert.equal(encoded.rawBits, 0x7f7fn);
});

test("e5m2 encodes 1.0", () => {
  const encoded = encodeValue("E5M2", 1, "RNE");
  assert.equal(encoded.rawBits, 0x3cn);
});

test("e5m2 uses round-to-nearest-even on ties", () => {
  const rne = encodeValue("E5M2", 1.375, "RNE");
  const rtz = encodeValue("E5M2", 1.375, "RTZ");

  assert.equal(rne.rawBits, 0x3en);
  assert.equal(rtz.rawBits, 0x3dn);
});

test("e5m2 saturates infinity to the maximum finite value under the OCP SAT profile", () => {
  const encoded = encodeValue("E5M2", Number.POSITIVE_INFINITY, "RNE");
  assert.equal(encoded.rawBits, 0x7bn);
});

test("e5m2 encodes NaN to the canonical OCP NaN payload", () => {
  const encoded = encodeValue("E5M2", Number.NaN, "RNE");
  assert.equal(encoded.rawBits, 0x7dn);
});

test("e4m3 encodes 1.0", () => {
  const encoded = encodeValue("E4M3", 1, "RNE");
  assert.equal(encoded.rawBits, 0x38n);
});

test("e4m3 uses round-to-nearest-even across the subnormal-to-normal boundary", () => {
  const midpoint = (0.875 * 2 ** -6 + 2 ** -6) / 2;
  const rne = encodeValue("E4M3", midpoint, "RNE");
  const rtz = encodeValue("E4M3", midpoint, "RTZ");

  assert.equal(rne.rawBits, 0x08n);
  assert.equal(rtz.rawBits, 0x07n);
});

test("e4m3 saturates overflow to the maximum finite value", () => {
  const encoded = encodeValue("E4M3", 500, "RNE");
  assert.equal(encoded.rawBits, 0x7en);
});

test("e4m3 encodes NaN to the single OCP NaN pattern", () => {
  const encoded = encodeValue("E4M3", Number.NaN, "RNE");
  assert.equal(encoded.rawBits, 0x7fn);
});

test("e2m1 encodes 1.0", () => {
  const encoded = encodeValue("E2M1", 1, "RNE");
  assert.equal(encoded.rawBits, 0x2n);
});

test("e2m1 distinguishes RNE and RTZ on the midpoint between subnormal and normal", () => {
  const rne = encodeValue("E2M1", 0.75, "RNE");
  const rtz = encodeValue("E2M1", 0.75, "RTZ");

  assert.equal(rne.rawBits, 0x2n);
  assert.equal(rtz.rawBits, 0x1n);
});

test("e2m1 saturates overflow to the maximum finite value", () => {
  const encoded = encodeValue("E2M1", 10, "RNE");
  assert.equal(encoded.rawBits, 0x7n);
});

test("e2m1 rejects NaN because the OCP FP4 profile has no NaN encoding", () => {
  assert.throws(() => encodeValue("E2M1", Number.NaN, "RNE"));
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
