import assert from "node:assert/strict";
import test from "node:test";

import type { ConversionStageReport } from "../../src/core/model/conversion-response.js";
import type { DecodedValue } from "../../src/core/model/decoded-value.js";
import { renderPanel, renderStage, renderStatusMessage } from "../../src/ui/templates.js";

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
