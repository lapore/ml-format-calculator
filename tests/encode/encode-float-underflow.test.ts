import assert from "node:assert/strict";
import test from "node:test";

import { decodeRawBits } from "../../src/core/decode/index.js";
import { encodeFloat } from "../../src/core/encode/encode-float.js";
import { getFormatDefinition } from "../../src/core/formats/index.js";
import type { FormatDefinition } from "../../src/core/model/format-definition.js";

function getPositiveMinSubnormalValue(formatId: "E5M2" | "E4M3" | "E2M1"): number {
  const format = getFormatDefinition(formatId);
  const limit = 1 << format.bitWidth;

  for (let raw = 0; raw < limit; raw += 1) {
    const decoded = decodeRawBits(formatId, BigInt(raw));
    if (decoded.classification === "SUBNORMAL" && decoded.sign === "POS" && decoded.decimalValue !== null) {
      return decoded.decimalValue;
    }
  }

  throw new Error(`${formatId}: positive minimum subnormal was not found`);
}

function cloneFormat(
  formatId: "E5M2" | "E4M3" | "E2M1",
  overrides: Partial<FormatDefinition>,
): FormatDefinition {
  return {
    ...getFormatDefinition(formatId),
    ...overrides,
  };
}

test("small OCP encoding honors zero underflow behavior by excluding subnormal outputs", () => {
  const format = cloneFormat("E5M2", { underflowBehavior: "zero" });
  const minSubnormal = getPositiveMinSubnormalValue("E5M2");
  const tinyPositiveValue = minSubnormal * 0.75;

  const encoded = encodeFloat(format, tinyPositiveValue, "RNE");
  const decoded = decodeRawBits("E5M2", encoded.rawBits);

  assert.equal(decoded.classification, "ZERO");
  assert.equal(decoded.sign, "POS");
});

test("small OCP encoding honors saturating underflow behavior", () => {
  const format = cloneFormat("E5M2", { underflowBehavior: "saturate" });
  const minSubnormal = getPositiveMinSubnormalValue("E5M2");
  const tinyPositiveValue = minSubnormal * 0.75;

  const encoded = encodeFloat(format, tinyPositiveValue, "RTZ");
  const decoded = decodeRawBits("E5M2", encoded.rawBits);

  assert.equal(decoded.classification, "SUBNORMAL");
  assert.equal(decoded.sign, "POS");
  assert.equal(decoded.decimalValue, minSubnormal);
});

test("small OCP encoding honors underflow error behavior", () => {
  const format = cloneFormat("E5M2", { underflowBehavior: "error" });
  const minSubnormal = getPositiveMinSubnormalValue("E5M2");
  const tinyPositiveValue = minSubnormal * 0.75;

  assert.throws(
    () => encodeFloat(format, tinyPositiveValue, "RNE"),
    /underflows the minimum finite magnitude/,
  );
});
