import assert from "node:assert/strict";
import test from "node:test";

import type { ConversionStageReport } from "../../src/core/model/conversion-response.js";
import type { DecodedValue } from "../../src/core/model/decoded-value.js";
import type { BitSliceResponse } from "../../src/core/model/bit-slice-response.js";
import { renderBitSlicePanel, renderPanel, renderStage, renderStatusMessage } from "../../src/ui/templates.js";

function createDecodedValue(overrides: Partial<DecodedValue> = {}): DecodedValue {
  return {
    formatId: "FP32",
    rawBits: 0n,
    rawBinary: "00000000000000000000000000000000",
    rawHex: "0x00000000",
    classification: "ZERO",
    sign: "POS",
    signBit: "0",
    exponentBits: "00000000",
    mantissaBits: "00000000000000000000000",
    exponentBias: 127,
    storedBiasedExponent: 0,
    actualExponent: null,
    decimalValue: 0,
    decimalValueText: "0",
    isZero: true,
    isSubnormal: false,
    isNormal: false,
    isInfinity: false,
    isNaN: false,
    nanKind: null,
    ...overrides,
  };
}

test("renderPanel uses the E4M3-specific NaN explanation", () => {
  const html = renderPanel(
    createDecodedValue({
      formatId: "E4M3",
      rawBits: 0x7fn,
      rawBinary: "01111111",
      rawHex: "0x7f",
      classification: "NAN",
      sign: "POS",
      exponentBits: "1111",
      mantissaBits: "111",
      exponentBias: 7,
      storedBiasedExponent: 15,
      decimalValue: Number.NaN,
      decimalValueText: "NaN",
      isZero: false,
      isNaN: true,
    }),
  );

  assert.match(html, /Only S 1111 111 is NaN/);
  assert.doesNotMatch(html, /Exponent = all ones, mantissa != 0/);
});

test("renderPanel uses qNaN and sNaN labels for IEEE-style NaN kinds", () => {
  const quietHtml = renderPanel(
    createDecodedValue({
      classification: "NAN",
      decimalValue: Number.NaN,
      decimalValueText: "qNaN",
      isZero: false,
      isNaN: true,
      nanKind: "quiet",
    }),
  );
  const signalingHtml = renderPanel(
    createDecodedValue({
      classification: "NAN",
      decimalValue: Number.NaN,
      decimalValueText: "sNaN",
      isZero: false,
      isNaN: true,
      nanKind: "signaling",
    }),
  );

  assert.match(quietHtml, /qNaN/);
  assert.doesNotMatch(quietHtml, />quiet</);
  assert.match(signalingHtml, /sNaN/);
  assert.doesNotMatch(signalingHtml, />signaling</);
});

test("renderPanel uses the UE8M0-specific NaN explanation", () => {
  const html = renderPanel(
    createDecodedValue({
      formatId: "UE8M0",
      rawBits: 0xffn,
      rawBinary: "11111111",
      rawHex: "0xff",
      classification: "NAN",
      sign: "NONE",
      signBit: null,
      exponentBits: "11111111",
      mantissaBits: null,
      exponentBias: 127,
      storedBiasedExponent: 255,
      decimalValue: Number.NaN,
      decimalValueText: "NaN",
      isZero: false,
      isNaN: true,
    }),
  );

  assert.match(html, /Only 11111111 is NaN/);
});

test("renderPanel uses the ExMy-specific NaN explanation", () => {
  const html = renderPanel(
    createDecodedValue({
      formatId: "ExMy",
      rawBits: 0x7en,
      rawBinary: "01111110",
      rawHex: "0x7e",
      classification: "NAN",
      sign: "POS",
      exponentBits: "11111",
      mantissaBits: "10",
      exponentBias: 15,
      storedBiasedExponent: 31,
      decimalValue: Number.NaN,
      decimalValueText: "qNaN",
      isZero: false,
      isNaN: true,
      nanKind: "quiet",
    }),
  );

  assert.match(html, /For ExMy, NaN uses an all-ones exponent/);
});

test("renderPanel explains that unsigned formats have no sign term", () => {
  const html = renderPanel(
    createDecodedValue({
      formatId: "UE8M0",
      rawBits: 0x7fn,
      rawBinary: "01111111",
      rawHex: "0x7f",
      classification: "NORMAL",
      sign: "NONE",
      signBit: null,
      exponentBits: "01111111",
      mantissaBits: null,
      exponentBias: 127,
      storedBiasedExponent: 127,
      actualExponent: 0,
      decimalValue: 1,
      decimalValueText: "1",
      isZero: false,
      isNormal: true,
    }),
  );

  assert.match(html, /Unsigned format, so the sign is always positive/);
  assert.doesNotMatch(html, /\(-1\)\^0/);
});

test("renderPanel uses integer interpretation text for int32 zero instead of float-zero wording", () => {
  const html = renderPanel(
    createDecodedValue({
      formatId: "INT32",
      rawBinary: "00000000000000000000000000000000",
      rawHex: "0x00000000",
      classification: "ZERO",
      sign: "NONE",
      signBit: "0",
      exponentBits: null,
      mantissaBits: null,
      exponentBias: null,
      storedBiasedExponent: null,
      actualExponent: null,
      decimalValue: 0,
      decimalValueText: "0",
      isZero: true,
    }),
  );

  assert.match(html, /Sign bit is 0, so the raw bits are already the positive integer value/);
  assert.doesNotMatch(html, /Exponent = 0 and mantissa = 0/);
});

test("renderPanel escapes user-visible field content", () => {
  const html = renderPanel(
    createDecodedValue({
      classification: "INTEGER",
      sign: "NEG",
      signBit: "<1>",
      decimalValueText: `<script>alert("x")</script>`,
      rawHex: `0x<bad>`,
      rawBinary: `1111<script>`,
      exponentBits: null,
      mantissaBits: null,
      exponentBias: null,
      storedBiasedExponent: null,
      actualExponent: null,
      isZero: false,
      isNormal: false,
    }),
  );

  assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.match(html, /0x&lt;bad&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test("renderStage escapes stage summaries", () => {
  const stage: ConversionStageReport = {
    stage: "source-to-target",
    applied: true,
    roundingModeApplied: false,
    valueChanged: true,
    summary: `changed <target> & "quoted"`,
  };

  const html = renderStage(stage);

  assert.match(html, /changed &lt;target&gt; &amp; &quot;quoted&quot;/);
  assert.doesNotMatch(html, /<target>/);
});

test("renderStatusMessage escapes error content", () => {
  const html = renderStatusMessage("error", `Bad <input> & "payload"`);

  assert.equal(html, `<p class="error">Bad &lt;input&gt; &amp; &quot;payload&quot;</p>`);
});

test("renderBitSlicePanel shows normalized input, outputs, and padding details", () => {
  const result: BitSliceResponse = {
    inputMode: "binary",
    inputBitWidth: 8,
    normalizedInputBinary: "10101010",
    normalizedInputHex: "0xaa",
    minBit: 0,
    maxBit: 3,
    sliceBitWidth: 4,
    sliceBinary: "1010",
    sliceHex: "0xa",
    sliceDecimal: "10",
    rangeLabel: "[3:0]",
    zeroPadBitCount: 2,
  };

  const html = renderBitSlicePanel(result);

  assert.match(html, /Normalized input \(binary\)/);
  assert.match(html, /10101010/);
  assert.match(html, /0xaa/);
  assert.match(html, /Zero-padded above the input width by 2 bits/);
});
