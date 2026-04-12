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

test("fp32 RTP rounds a tiny positive value up to the minimum subnormal when RNE and RTZ would produce zero", () => {
  const minSubnormal = 2 ** -149;
  const rne = encodeValue("FP32", 0.25 * minSubnormal, "RNE");
  const rtz = encodeValue("FP32", 0.25 * minSubnormal, "RTZ");
  const rtp = encodeValue("FP32", 0.25 * minSubnormal, "RTP");

  assert.equal(rne.rawBits, 0x00000000n);
  assert.equal(rtz.rawBits, 0x00000000n);
  assert.equal(rtp.rawBits, 0x00000001n);
});

test("fp32 RTZ rounds a tiny negative value up to negative zero when RNE would produce a subnormal", () => {
  const minSubnormal = 2 ** -149;
  const rne = encodeValue("FP32", -0.75 * minSubnormal, "RNE");
  const rtz = encodeValue("FP32", -0.75 * minSubnormal, "RTZ");

  assert.equal(rne.rawBits, 0x80000001n);
  assert.equal(rtz.rawBits, 0x80000000n);
});

test("fp32 RTP rounds a tiny negative value up to negative zero when RNE would produce a subnormal", () => {
  const minSubnormal = 2 ** -149;
  const rne = encodeValue("FP32", -0.75 * minSubnormal, "RNE");
  const rtp = encodeValue("FP32", -0.75 * minSubnormal, "RTP");

  assert.equal(rne.rawBits, 0x80000001n);
  assert.equal(rtp.rawBits, 0x80000000n);
});

test("fp32 RTZ overflows finite values to the maximum finite magnitude instead of infinity", () => {
  const rne = encodeValue("FP32", Number.MAX_VALUE, "RNE");
  const rtz = encodeValue("FP32", Number.MAX_VALUE, "RTZ");

  assert.equal(rne.rawBits, 0x7f800000n);
  assert.equal(rtz.rawBits, 0x7f7fffffn);
});

test("fp32 RTP overflows positive finite values to infinity and negative finite values to the maximum finite negative value", () => {
  const positive = encodeValue("FP32", Number.MAX_VALUE, "RTP");
  const negative = encodeValue("FP32", -Number.MAX_VALUE, "RTP");

  assert.equal(positive.rawBits, 0x7f800000n);
  assert.equal(negative.rawBits, 0xff7fffffn);
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

test("fp16 RTP rounds positive values toward +inf and negative values toward zero", () => {
  const midpoint = 1 + 2 ** -11;
  const positive = encodeValue("FP16", midpoint, "RTP");
  const negative = encodeValue("FP16", -midpoint, "RTP");

  assert.equal(positive.rawBits, 0x3c01n);
  assert.equal(negative.rawBits, 0xbc00n);
});

test("fp16 RTP overflows positive finite values to infinity and negative finite values to the maximum finite negative value", () => {
  const positive = encodeValue("FP16", 1e10, "RTP");
  const negative = encodeValue("FP16", -1e10, "RTP");

  assert.equal(positive.rawBits, 0x7c00n);
  assert.equal(negative.rawBits, 0xfbffn);
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

test("bf16 RTP rounds positive values toward +inf and negative values toward zero", () => {
  const positive = encodeValue("BF16", 1.006, "RTP");
  const negative = encodeValue("BF16", -1.006, "RTP");

  assert.equal(positive.rawBits, 0x3f81n);
  assert.equal(negative.rawBits, 0xbf80n);
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

test("bf16 RTP overflows positive finite values to infinity and negative finite values to the maximum finite negative value", () => {
  const positive = encodeValue("BF16", Number.MAX_VALUE, "RTP");
  const negative = encodeValue("BF16", -Number.MAX_VALUE, "RTP");

  assert.equal(positive.rawBits, 0x7f80n);
  assert.equal(negative.rawBits, 0xff7fn);
});

test("e5m2 encodes 1.0", () => {
  const encoded = encodeValue("E5M2", 1, "RNE");
  assert.equal(encoded.rawBits, 0x3cn);
});

test("e5m2 uses round-to-nearest-even on ties", () => {
  const rne = encodeValue("E5M2", 1.375, "RNE");
  const rtz = encodeValue("E5M2", 1.375, "RTZ");
  const rtp = encodeValue("E5M2", 1.375, "RTP");

  assert.equal(rne.rawBits, 0x3en);
  assert.equal(rtz.rawBits, 0x3dn);
  assert.equal(rtp.rawBits, 0x3en);
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
  const rtp = encodeValue("E4M3", midpoint, "RTP");

  assert.equal(rne.rawBits, 0x08n);
  assert.equal(rtz.rawBits, 0x07n);
  assert.equal(rtp.rawBits, 0x08n);
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
  const rtp = encodeValue("E2M1", 0.75, "RTP");

  assert.equal(rne.rawBits, 0x2n);
  assert.equal(rtz.rawBits, 0x1n);
  assert.equal(rtp.rawBits, 0x2n);
});

test("e2m1 saturates overflow to the maximum finite value", () => {
  const encoded = encodeValue("E2M1", 10, "RNE");
  assert.equal(encoded.rawBits, 0x7n);
});

test("e2m1 rejects NaN because the OCP FP4 profile has no NaN encoding", () => {
  assert.throws(() => encodeValue("E2M1", Number.NaN, "RNE"));
});

test("ue8m0 encodes 1.0", () => {
  const encoded = encodeValue("UE8M0", 1, "RNE");
  assert.equal(encoded.rawBits, 0x7fn);
});

test("ue8m0 uses absolute-value encoding for negative finite inputs", () => {
  const encoded = encodeValue("UE8M0", -1, "RNE");
  assert.equal(encoded.rawBits, 0x7fn);
});

test("ue8m0 saturates zero to the minimum finite value because zero is not representable", () => {
  const encoded = encodeValue("UE8M0", 0, "RNE");
  assert.equal(encoded.rawBits, 0x00n);
});

test("ue8m0 distinguishes RNE, RTZ, and RTP between adjacent powers of two", () => {
  const rne = encodeValue("UE8M0", 1.5, "RNE");
  const rtz = encodeValue("UE8M0", 1.5, "RTZ");
  const rtp = encodeValue("UE8M0", 1.5, "RTP");

  assert.equal(rne.rawBits, 0x80n);
  assert.equal(rtz.rawBits, 0x7fn);
  assert.equal(rtp.rawBits, 0x80n);
});

test("ue8m0 saturates infinity to the maximum finite value", () => {
  const encoded = encodeValue("UE8M0", Number.POSITIVE_INFINITY, "RNE");
  assert.equal(encoded.rawBits, 0xfen);
});

test("ue8m0 encodes NaN to the reserved all-ones pattern", () => {
  const encoded = encodeValue("UE8M0", Number.NaN, "RNE");
  assert.equal(encoded.rawBits, 0xffn);
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

test("int32 RTP rounds toward positive infinity", () => {
  const positive = encodeValue("INT32", 2.1, "RTP");
  const negative = encodeValue("INT32", -2.9, "RTP");

  assert.equal(positive.rawBits, 0x3n);
  assert.equal(negative.rawBits, 0xfffffffen);
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
