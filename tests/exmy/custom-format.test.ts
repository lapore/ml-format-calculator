import assert from "node:assert/strict";
import test from "node:test";

import { convertValue } from "../../src/core/convert/convert-value.js";
import { decodeBitsForFormat } from "../../src/core/decode/index.js";
import { encodeValueForFormat } from "../../src/core/encode/index.js";
import { createCustomFloatFormat } from "../../src/core/formats/custom-exmy.js";
import type { CustomFloatSpec } from "../../src/core/model/custom-float-spec.js";

const defaultSpec: CustomFloatSpec = {
  hasSignBit: true,
  exponentBitCount: 5,
  mantissaBitCount: 2,
  supportsInfinity: true,
  supportsNaN: true,
};

test("ExMy format metadata reflects the requested runtime profile", () => {
  const format = createCustomFloatFormat(defaultSpec);

  assert.equal(format.id, "ExMy");
  assert.equal(format.displayName, "ExMy (S1 E5 M2)");
  assert.equal(format.bitWidth, 8);
  assert.equal(format.exponentBias, 15);
  assert.equal(format.supportsInfinity, true);
  assert.equal(format.supportsNaN, true);
  assert.equal(format.supportsQNaN, true);
  assert.equal(format.supportsSNaN, true);
});

test("ExMy rejects NaN support when there are no mantissa bits", () => {
  assert.throws(
    () =>
      createCustomFloatFormat({
        hasSignBit: true,
        exponentBitCount: 4,
        mantissaBitCount: 0,
        supportsInfinity: true,
        supportsNaN: true,
      }),
    /NaN support requires at least one mantissa bit/,
  );
});

test("ExMy rejects exponent widths below 2 bits", () => {
  assert.throws(
    () =>
      createCustomFloatFormat({
        hasSignBit: true,
        exponentBitCount: 1,
        mantissaBitCount: 2,
        supportsInfinity: true,
        supportsNaN: true,
      }),
    /exponent bits must be between 2 and 10/,
  );
});

test("ExMy IEEE-like decoding recognizes infinity, qNaN, and sNaN when enabled", () => {
  const format = createCustomFloatFormat(defaultSpec);
  const infinity = decodeBitsForFormat(format, 0x7cn);
  const quietNaN = decodeBitsForFormat(format, 0x7en);
  const signalingNaN = decodeBitsForFormat(format, 0x7dn);

  assert.equal(infinity.classification, "INF");
  assert.equal(quietNaN.classification, "NAN");
  assert.equal(quietNaN.nanKind, "quiet");
  assert.equal(signalingNaN.classification, "NAN");
  assert.equal(signalingNaN.nanKind, "signaling");
});

test("ExMy keeps all-ones zero-mantissa encodings finite when infinity is disabled", () => {
  const format = createCustomFloatFormat({
    ...defaultSpec,
    supportsInfinity: false,
  });
  const decoded = decodeBitsForFormat(format, 0x7cn);

  assert.equal(decoded.classification, "NORMAL");
  assert.equal(decoded.decimalValue, 65536);
});

test("ExMy keeps all-ones non-zero mantissa encodings finite when NaN is disabled", () => {
  const format = createCustomFloatFormat({
    ...defaultSpec,
    supportsNaN: false,
  });
  const decoded = decodeBitsForFormat(format, 0x7dn);

  assert.equal(decoded.classification, "NORMAL");
  assert.equal(decoded.isNaN, false);
});

test("ExMy with NaN but no infinity preserves the finite all-ones zero-mantissa value", () => {
  const format = createCustomFloatFormat({
    ...defaultSpec,
    supportsInfinity: false,
    supportsNaN: true,
  });

  const encodedMaxFinite = encodeValueForFormat(format, 65536, "RNE");
  const decodedMaxFinite = decodeBitsForFormat(format, encodedMaxFinite.rawBits);
  const encodedAboveMax = encodeValueForFormat(format, 70000, "RNE");

  assert.equal(encodedMaxFinite.rawHex, "0x7c");
  assert.equal(decodedMaxFinite.classification, "NORMAL");
  assert.equal(decodedMaxFinite.decimalValue, 65536);
  assert.equal(encodedAboveMax.rawHex, "0x7c");
});

test("ExMy with infinity but no NaN keeps finite all-ones exponent payloads available", () => {
  const format = createCustomFloatFormat({
    ...defaultSpec,
    supportsInfinity: true,
    supportsNaN: false,
  });

  const roundedNearest = encodeValueForFormat(format, 70000, "RNE");
  const roundedTowardPositiveInfinity = encodeValueForFormat(format, 65536, "RTP");
  const decodedNearest = decodeBitsForFormat(format, roundedNearest.rawBits);
  const decodedTowardPositiveInfinity = decodeBitsForFormat(format, roundedTowardPositiveInfinity.rawBits);

  assert.equal(roundedNearest.rawHex, "0x7d");
  assert.equal(decodedNearest.classification, "NORMAL");
  assert.equal(decodedNearest.decimalValue, 81920);
  assert.equal(roundedTowardPositiveInfinity.rawHex, "0x7d");
  assert.equal(decodedTowardPositiveInfinity.classification, "NORMAL");
  assert.equal(decodedTowardPositiveInfinity.decimalValue, 81920);
});

test("ExMy decimal encoding matches the IEEE-like E5M2 profile for simple finite values", () => {
  const format = createCustomFloatFormat(defaultSpec);
  const encoded = encodeValueForFormat(format, 1, "RNE");

  assert.equal(encoded.rawHex, "0x3c");
});

test("ExMy unsigned profiles reject negative decimal inputs", () => {
  const format = createCustomFloatFormat({
    ...defaultSpec,
    hasSignBit: false,
  });

  assert.throws(
    () => encodeValueForFormat(format, -1, "RNE"),
    /cannot encode negative decimal values/,
  );
});

test("ExMy profiles without subnormals round tiny positive values up to min normal in RTP", () => {
  const format = createCustomFloatFormat({
    hasSignBit: true,
    exponentBitCount: 3,
    mantissaBitCount: 0,
    supportsInfinity: true,
    supportsNaN: false,
  });
  const encoded = encodeValueForFormat(format, 0.2, "RTP");
  const decoded = decodeBitsForFormat(format, encoded.rawBits);

  assert.equal(decoded.classification, "NORMAL");
  assert.equal(decoded.decimalValue, 0.25);
});

test("ExMy profiles without NaN support reject decimal NaN input", () => {
  const format = createCustomFloatFormat({
    ...defaultSpec,
    supportsNaN: false,
  });

  assert.throws(
    () => encodeValueForFormat(format, Number.NaN, "RNE"),
    /NaN is not representable/,
  );
});

test("inspection mode decodes ExMy raw input exactly", () => {
  const result = convertValue({
    mode: "inspection",
    sourceFormatId: "ExMy",
    customFormatSpec: defaultSpec,
    inputMode: "hex",
    inputValue: "0x7e",
    roundingMode: "RNE",
  });

  assert.equal(result.source.classification, "NAN");
  assert.equal(result.source.nanKind, "quiet");
  assert.equal(result.target, null);
  assert.equal(result.stages[0]?.applied, false);
});

test("inspection mode encodes decimal input into the ExMy source profile only", () => {
  const result = convertValue({
    mode: "inspection",
    sourceFormatId: "ExMy",
    customFormatSpec: defaultSpec,
    inputMode: "decimal",
    inputValue: "1",
    roundingMode: "RNE",
  });

  assert.equal(result.source.rawHex, "0x3c");
  assert.equal(result.target, null);
  assert.equal(result.stages[0]?.applied, true);
  assert.match(result.notes.join(" "), /ExMy \(S1 E5 M2\)/);
});
