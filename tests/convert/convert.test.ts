import test from "node:test";
import assert from "node:assert/strict";

import type { CalculationRequest } from "../../src/core/model/conversion-request.js";
import { convertValue } from "../../src/core/convert/convert-value.js";

test("inspection mode decodes decimal input into the source format only", () => {
  const result = convertValue({
    mode: "inspection",
    sourceFormatId: "BF16",
    inputMode: "decimal",
    inputValue: "1.006",
    roundingMode: "RTZ",
  });

  assert.equal(result.mode, "inspection");
  assert.equal(result.source.formatId, "BF16");
  assert.equal(result.source.decimalValue, 1);
  assert.equal(result.target, null);
  assert.equal(result.encodedTarget, null);
  assert.equal(result.stages.length, 1);
  assert.equal(result.stages[0]?.stage, "input-to-source");
  assert.equal(result.stages[0]?.valueChanged, true);
  assert.equal(result.warnings.length, 1);
  assert.match(result.notes.join(" "), /Mode: inspection/);
  assert.doesNotMatch(result.notes.join(" "), /NaN policy/);
});

test("inspection mode decodes raw input exactly without a target stage", () => {
  const result = convertValue({
    mode: "inspection",
    sourceFormatId: "FP16",
    inputMode: "hex",
    inputValue: "0x4680",
    roundingMode: "RNE",
  });

  assert.equal(result.source.decimalValue, 6.5);
  assert.equal(result.target, null);
  assert.equal(result.encodedTarget, null);
  assert.equal(result.stages.length, 1);
  assert.equal(result.stages[0]?.applied, false);
  assert.equal(result.warnings.length, 0);
  assert.match(result.notes.join(" "), /decoded exactly/i);
});

test("conversion mode requires a target format", () => {
  assert.throws(() =>
    convertValue({
      mode: "conversion",
      sourceFormatId: "FP32",
      inputMode: "decimal",
      inputValue: "6.5",
      roundingMode: "RNE",
    } as unknown as CalculationRequest),
  );
});

test("converts decimal fp32 input to fp16", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "FP16",
    inputMode: "decimal",
    inputValue: "6.5",
    roundingMode: "RNE",
  });

  assert.equal(result.source.formatId, "FP32");
  assert.equal(result.target.formatId, "FP16");
  assert.equal(result.source.decimalValue, 6.5);
  assert.equal(result.target.decimalValue, 6.5);
  assert.equal(result.encodedTarget?.rawBits, 0x4680n);
  assert.equal(result.stages[0]?.stage, "input-to-source");
  assert.equal(result.stages[0]?.valueChanged, false);
  assert.equal(result.stages[1]?.stage, "source-to-target");
  assert.equal(result.stages[1]?.valueChanged, false);
});

test("converts raw fp32 bits to bf16", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "BF16",
    inputMode: "hex",
    inputValue: "0x40d00000",
    roundingMode: "RNE",
  });

  assert.equal(result.source.decimalValue, 6.5);
  assert.equal(result.target.decimalValue, 6.5);
  assert.equal(result.encodedTarget?.rawBits, 0x40d0n);
  assert.equal(result.stages[0]?.applied, false);
  assert.equal(result.stages[1]?.applied, true);
});

test("converts raw e5m2 infinity to fp32", () => {
  const result = convertValue({
    sourceFormatId: "E5M2",
    targetFormatId: "FP32",
    inputMode: "hex",
    inputValue: "0x7c",
    roundingMode: "RNE",
  });

  assert.equal(result.source.classification, "INF");
  assert.equal(result.target.classification, "INF");
  assert.equal(result.target.decimalValueText, "+inf");
});

test("converts raw e4m3 maximum normal to fp32", () => {
  const result = convertValue({
    sourceFormatId: "E4M3",
    targetFormatId: "FP32",
    inputMode: "hex",
    inputValue: "0x7e",
    roundingMode: "RNE",
  });

  assert.equal(result.source.decimalValue, 448);
  assert.equal(result.target.decimalValue, 448);
  assert.equal(result.target.classification, "NORMAL");
});

test("converts binary fp16 bits exactly before targeting fp32", () => {
  const result = convertValue({
    sourceFormatId: "FP16",
    targetFormatId: "FP32",
    inputMode: "binary",
    inputValue: "0100011010000000",
    roundingMode: "RNE",
  });

  assert.equal(result.source.decimalValue, 6.5);
  assert.equal(result.target.decimalValue, 6.5);
  assert.equal(result.stages[0]?.applied, false);
  assert.equal(result.stages[0]?.roundingModeApplied, false);
  assert.equal(result.stages[1]?.valueChanged, false);
});

test("converts decimal to e2m1 and then into fp32 using the rounded source value", () => {
  const result = convertValue({
    sourceFormatId: "E2M1",
    targetFormatId: "FP32",
    inputMode: "decimal",
    inputValue: "0.75",
    roundingMode: "RNE",
  });

  assert.equal(result.source.rawHex, "0x2");
  assert.equal(result.source.decimalValue, 1);
  assert.equal(result.target.decimalValue, 1);
  assert.equal(result.stages[0]?.valueChanged, true);
  assert.equal(result.stages[1]?.valueChanged, false);
});

test("converts decimal to int32 with RTZ", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "INT32",
    inputMode: "decimal",
    inputValue: "-2.9",
    roundingMode: "RTZ",
  });

  assert.equal(result.target.classification, "INTEGER");
  assert.equal(result.target.decimalValueText, "-2");
  assert.equal(result.encodedTarget?.rawBits, 0xfffffffen);
  assert.equal(result.stages[0]?.valueChanged, true);
  assert.equal(result.stages[1]?.valueChanged, true);
});

test("converts decimal to int32 with RTP", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "INT32",
    inputMode: "decimal",
    inputValue: "2.1",
    roundingMode: "RTP",
  });

  assert.equal(result.target.classification, "INTEGER");
  assert.equal(result.target.decimalValueText, "3");
  assert.equal(result.encodedTarget?.rawBits, 0x3n);
  assert.equal(result.stages[0]?.valueChanged, true);
  assert.equal(result.stages[1]?.valueChanged, true);
});

test("conversion notes include NaN policy when both source and target define NaN encodings", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "BF16",
    inputMode: "decimal",
    inputValue: "1",
    roundingMode: "RNE",
    nanPolicy: "canonical",
  });

  assert.match(result.notes.join(" "), /NaN policy: canonical/);
});

test("conversion notes omit NaN policy when the source format cannot encode NaN", () => {
  const result = convertValue({
    sourceFormatId: "INT32",
    targetFormatId: "FP16",
    inputMode: "decimal",
    inputValue: "42",
    roundingMode: "RNE",
    nanPolicy: "canonical",
  });

  assert.doesNotMatch(result.notes.join(" "), /NaN policy/);
});

test("conversion notes omit NaN policy when the target format cannot encode NaN", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "INT32",
    inputMode: "decimal",
    inputValue: "42",
    roundingMode: "RNE",
    nanPolicy: "canonical",
  });

  assert.doesNotMatch(result.notes.join(" "), /NaN policy/);
});

test("adds warnings for every stage that changes the value", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "BF16",
    inputMode: "decimal",
    inputValue: "1.006",
    roundingMode: "RTZ",
  });

  assert.equal(result.warnings.length, 2);
  assert.match(result.warnings[0] ?? "", /Input -> source/);
  assert.match(result.warnings[1] ?? "", /Source -> target/);
});

test("records source-stage rounding when decimal input narrows immediately", () => {
  const result = convertValue({
    sourceFormatId: "BF16",
    targetFormatId: "FP32",
    inputMode: "decimal",
    inputValue: "1.006",
    roundingMode: "RTZ",
  });

  assert.equal(result.stages[0]?.stage, "input-to-source");
  assert.equal(result.stages[0]?.valueChanged, true);
  assert.match(result.stages[0]?.summary ?? "", /Input -> source/);
});

test("inspection mode uses RTP when decimal input must round upward", () => {
  const result = convertValue({
    mode: "inspection",
    sourceFormatId: "BF16",
    inputMode: "decimal",
    inputValue: "1.006",
    roundingMode: "RTP",
  });

  assert.equal(result.source.rawHex, "0x3f81");
  assert.equal(result.source.decimalValue, 1.0078125);
  assert.equal(result.stages[0]?.valueChanged, true);
  assert.match(result.stages[0]?.summary ?? "", /RTP/);
});

test("decimal conversion uses the rounded source value before encoding the target", () => {
  const result = convertValue({
    sourceFormatId: "BF16",
    targetFormatId: "FP32",
    inputMode: "decimal",
    inputValue: "1.006",
    roundingMode: "RTZ",
  });

  assert.equal(result.source.decimalValue, 1);
  assert.equal(result.target.decimalValue, 1);
  assert.equal(result.stages[0]?.valueChanged, true);
  assert.equal(result.stages[1]?.valueChanged, false);
});

test("preserves infinities through conversion", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "FP16",
    inputMode: "decimal",
    inputValue: "+inf",
    roundingMode: "RNE",
  });

  assert.equal(result.source.classification, "INF");
  assert.equal(result.target.classification, "INF");
  assert.equal(result.target.decimalValueText, "+inf");
  assert.equal(result.stages[0]?.roundingModeApplied, false);
  assert.equal(result.stages[1]?.roundingModeApplied, false);
  assert.match(result.stages[1]?.summary ?? "", /without numeric rounding/);
});

test("saturates infinity when converting to the OCP e5m2 SAT profile", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "E5M2",
    inputMode: "decimal",
    inputValue: "+inf",
    roundingMode: "RNE",
  });

  assert.equal(result.source.classification, "INF");
  assert.equal(result.target.classification, "NORMAL");
  assert.equal(result.target.rawHex, "0x7b");
  assert.equal(result.target.decimalValue, 57344);
  assert.equal(result.stages[1]?.roundingModeApplied, false);
  assert.match(result.stages[1]?.summary ?? "", /without numeric rounding/);
});

test("preserves NaN through conversion", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "BF16",
    inputMode: "decimal",
    inputValue: "nan",
    roundingMode: "RNE",
  });

  assert.equal(result.source.classification, "NAN");
  assert.equal(result.target.classification, "NAN");
  assert.equal(result.stages[1]?.valueChanged, true);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.target.rawHex, "0x7fc0");
});

test("canonical NaN policy maps fp32 NaN to the OCP e4m3 NaN pattern", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "E4M3",
    inputMode: "decimal",
    inputValue: "nan",
    roundingMode: "RNE",
    nanPolicy: "canonical",
  });

  assert.equal(result.target.classification, "NAN");
  assert.equal(result.target.nanKind, null);
  assert.equal(result.target.rawHex, "0x7f");
});

test("custom canonical NaN value overrides the e5m2 default", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "E5M2",
    inputMode: "decimal",
    inputValue: "nan",
    roundingMode: "RNE",
    nanPolicy: "canonical",
    canonicalNaNInput: "0x7f",
  });

  assert.equal(result.target.classification, "NAN");
  assert.equal(result.target.rawHex, "0x7f");
});

test("custom canonical NaN value overrides the e4m3 default", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "E4M3",
    inputMode: "decimal",
    inputValue: "nan",
    roundingMode: "RNE",
    nanPolicy: "canonical",
    canonicalNaNInput: "0xff",
  });

  assert.equal(result.target.classification, "NAN");
  assert.equal(result.target.rawHex, "0xff");
});

test("preserve NaN policy maps fp32 NaN to an OCP e5m2 NaN encoding", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "E5M2",
    inputMode: "hex",
    inputValue: "0x7fc00000",
    roundingMode: "RNE",
    nanPolicy: "preserve",
  });

  assert.equal(result.target.classification, "NAN");
  assert.equal(result.target.nanKind, null);
  assert.notEqual(result.target.rawHex, "0x7c");
});

test("default same-format raw fp32 conversion canonicalizes signaling NaN", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "FP32",
    inputMode: "hex",
    inputValue: "0x7fa00001",
    roundingMode: "RNE",
  });

  assert.equal(result.source.rawHex, "0x7fa00001");
  assert.equal(result.target.rawHex, "0x7fc00000");
  assert.equal(result.source.nanKind, "signaling");
  assert.equal(result.target.nanKind, "quiet");
  assert.equal(result.stages[1]?.valueChanged, true);
  assert.equal(result.warnings.length, 1);
});

test("default fp32 to fp16 conversion canonicalizes signaling NaN", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "FP16",
    inputMode: "hex",
    inputValue: "0x7fa00001",
    roundingMode: "RNE",
  });

  assert.equal(result.source.nanKind, "signaling");
  assert.equal(result.target.classification, "NAN");
  assert.equal(result.target.nanKind, "quiet");
  assert.equal(result.target.rawHex, "0x7e00");
});

test("canonical NaN policy canonicalizes fp32 signaling NaN to fp16", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "FP16",
    inputMode: "hex",
    inputValue: "0x7fa00001",
    roundingMode: "RNE",
    nanPolicy: "canonical",
  });

  assert.equal(result.target.classification, "NAN");
  assert.equal(result.target.nanKind, "quiet");
  assert.equal(result.target.rawHex, "0x7e00");
  assert.match(result.stages[1]?.summary ?? "", /NaN canonicalized/);
});

test("custom canonical NaN value overrides the fp16 default", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "FP16",
    inputMode: "hex",
    inputValue: "0x7fc00000",
    roundingMode: "RNE",
    nanPolicy: "canonical",
    canonicalNaNInput: "0x7d01",
  });

  assert.equal(result.target.classification, "NAN");
  assert.equal(result.target.nanKind, "signaling");
  assert.equal(result.target.rawHex, "0x7d01");
  assert.match(result.notes.join(" "), /custom target value 0x7d01/i);
});

test("canonical NaN policy canonicalizes fp32 signaling NaN to bf16", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "BF16",
    inputMode: "hex",
    inputValue: "0x7fa00001",
    roundingMode: "RNE",
    nanPolicy: "canonical",
  });

  assert.equal(result.target.classification, "NAN");
  assert.equal(result.target.nanKind, "quiet");
  assert.equal(result.target.rawHex, "0x7fc0");
  assert.match(result.stages[1]?.summary ?? "", /NaN canonicalized/);
});

test("custom canonical NaN value overrides the bf16 default", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "BF16",
    inputMode: "hex",
    inputValue: "0x7fc00000",
    roundingMode: "RNE",
    nanPolicy: "canonical",
    canonicalNaNInput: "0x7f81",
  });

  assert.equal(result.target.classification, "NAN");
  assert.equal(result.target.nanKind, "signaling");
  assert.equal(result.target.rawHex, "0x7f81");
});

test("canonical NaN policy canonicalizes fp16 signaling NaN to fp32", () => {
  const result = convertValue({
    sourceFormatId: "FP16",
    targetFormatId: "FP32",
    inputMode: "hex",
    inputValue: "0x7d01",
    roundingMode: "RNE",
    nanPolicy: "canonical",
  });

  assert.equal(result.target.classification, "NAN");
  assert.equal(result.target.nanKind, "quiet");
  assert.equal(result.target.rawHex, "0x7fc00000");
});

test("custom canonical NaN value overrides the fp32 default", () => {
  const result = convertValue({
    sourceFormatId: "FP16",
    targetFormatId: "FP32",
    inputMode: "hex",
    inputValue: "0x7e00",
    roundingMode: "RNE",
    nanPolicy: "canonical",
    canonicalNaNInput: "0x7fa00001",
  });

  assert.equal(result.target.classification, "NAN");
  assert.equal(result.target.nanKind, "signaling");
  assert.equal(result.target.rawHex, "0x7fa00001");
});

test("canonical NaN policy canonicalizes same-format fp32 NaN", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "FP32",
    inputMode: "hex",
    inputValue: "0x7fa00001",
    roundingMode: "RNE",
    nanPolicy: "canonical",
  });

  assert.equal(result.source.rawHex, "0x7fa00001");
  assert.equal(result.target.rawHex, "0x7fc00000");
  assert.equal(result.stages[1]?.applied, true);
  assert.equal(result.stages[1]?.valueChanged, true);
  assert.match(result.stages[1]?.summary ?? "", /NaN canonicalized/);
});

test("canonical NaN policy does not affect ordinary finite conversions", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "BF16",
    inputMode: "decimal",
    inputValue: "6.5",
    roundingMode: "RNE",
    nanPolicy: "canonical",
  });

  assert.equal(result.target.rawHex, "0x40d0");
  assert.equal(result.target.classification, "NORMAL");
  assert.equal(result.warnings.length, 0);
});

test("custom canonical NaN value must match the target format width", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "BF16",
    inputMode: "hex",
    inputValue: "0x7fc00000",
    roundingMode: "RNE",
    nanPolicy: "canonical",
    canonicalNaNInput: "0x7fc00000",
  });

  assert.equal(result.target.classification, "UNREPRESENTABLE");
  assert.match(result.targetError ?? "", /Invalid hex width/);
});

test("custom canonical NaN value must decode to NaN", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "BF16",
    inputMode: "hex",
    inputValue: "0x7fc00000",
    roundingMode: "RNE",
    nanPolicy: "canonical",
    canonicalNaNInput: "0x3f80",
  });

  assert.equal(result.target.classification, "UNREPRESENTABLE");
  assert.match(result.targetError ?? "", /canonical NaN value must decode to NaN/);
});

test("marks NaN representation changes as value-changing during cross-format conversion", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "BF16",
    inputMode: "hex",
    inputValue: "0x7fc12345",
    roundingMode: "RNE",
    nanPolicy: "preserve",
  });

  assert.equal(result.source.classification, "NAN");
  assert.equal(result.target.classification, "NAN");
  assert.equal(result.stages[1]?.stage, "source-to-target");
  assert.equal(result.stages[1]?.valueChanged, true);
  assert.equal(result.stages[1]?.roundingModeApplied, false);
  assert.match(result.stages[1]?.summary ?? "", /NaN representation changed/);
  assert.equal(result.warnings.length, 1);
});

test("preserve NaN policy remains available as an explicit mode", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "BF16",
    inputMode: "hex",
    inputValue: "0x7fa00001",
    roundingMode: "RNE",
    nanPolicy: "preserve",
  });

  assert.equal(result.target.rawHex, "0x7fa0");
  assert.equal(result.target.nanKind, "signaling");
});

test("returns an unrepresentable target for infinity to int32", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "INT32",
    inputMode: "decimal",
    inputValue: "+inf",
    roundingMode: "RNE",
  });

  assert.equal(result.source.classification, "INF");
  assert.equal(result.target.classification, "UNREPRESENTABLE");
  assert.equal(result.encodedTarget, null);
  assert.match(result.targetError ?? "", /INT32 cannot represent/);
});

test("returns an unrepresentable target for NaN to int32", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "INT32",
    inputMode: "hex",
    inputValue: "0x7fc00000",
    roundingMode: "RNE",
  });

  assert.equal(result.source.classification, "NAN");
  assert.equal(result.target.classification, "UNREPRESENTABLE");
  assert.equal(result.encodedTarget, null);
  assert.match(result.targetError ?? "", /INT32 cannot represent/);
});

test("returns an unrepresentable target for NaN to e2m1 because fp4 has no NaN encoding", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "E2M1",
    inputMode: "decimal",
    inputValue: "nan",
    roundingMode: "RNE",
  });

  assert.equal(result.target.classification, "UNREPRESENTABLE");
  assert.equal(result.encodedTarget, null);
  assert.match(result.targetError ?? "", /E2M1 cannot represent/);
});

test("reports exact source decode for raw-bit negative zero", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "FP32",
    inputMode: "hex",
    inputValue: "0x80000000",
    roundingMode: "RNE",
  });

  assert.equal(result.source.decimalValueText, "-0");
  assert.equal(result.stages[0]?.summary, "Input -> source: exact decode, no rounding step applied.");
});

test("converts zero to ue8m0 by saturating to the minimum finite value", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "UE8M0",
    inputMode: "decimal",
    inputValue: "0",
    roundingMode: "RNE",
  });

  assert.equal(result.target.classification, "NORMAL");
  assert.equal(result.target.rawHex, "0x00");
  assert.equal(result.target.decimalValue, 2 ** -127);
  assert.match(result.notes.join(" "), /no zero encoding/i);
});

test("converts negative infinity to ue8m0 by saturating to the maximum finite value", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "UE8M0",
    inputMode: "decimal",
    inputValue: "-inf",
    roundingMode: "RNE",
  });

  assert.equal(result.source.classification, "INF");
  assert.equal(result.target.classification, "NORMAL");
  assert.equal(result.target.rawHex, "0xfe");
  assert.equal(result.target.decimalValue, 2 ** 127);
});

test("preserve NaN policy still collapses to the single ue8m0 NaN pattern", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "UE8M0",
    inputMode: "hex",
    inputValue: "0x7fc12345",
    roundingMode: "RNE",
    nanPolicy: "preserve",
  });

  assert.equal(result.target.classification, "NAN");
  assert.equal(result.target.rawHex, "0xff");
  assert.equal(result.stages[1]?.roundingModeApplied, false);
});

test("rejects malformed binary input", () => {
  assert.throws(() =>
    convertValue({
      sourceFormatId: "FP32",
      targetFormatId: "FP16",
      inputMode: "binary",
      inputValue: "01012",
      roundingMode: "RNE",
    }),
  );
});

test("rejects malformed hex input", () => {
  assert.throws(() =>
    convertValue({
      sourceFormatId: "FP32",
      targetFormatId: "FP16",
      inputMode: "hex",
      inputValue: "0xzzzz",
      roundingMode: "RNE",
    }),
  );
});

test("rejects empty decimal input", () => {
  assert.throws(() =>
    convertValue({
      sourceFormatId: "FP32",
      targetFormatId: "FP16",
      inputMode: "decimal",
      inputValue: "",
      roundingMode: "RNE",
    }),
  );
});

test("rejects out-of-range decimal input", () => {
  assert.throws(() =>
    convertValue({
      sourceFormatId: "FP32",
      targetFormatId: "FP16",
      inputMode: "decimal",
      inputValue: "1e9999",
      roundingMode: "RNE",
    }),
  );
});

test("rejects non-decimal literal syntax in decimal mode", () => {
  for (const inputValue of ["0x10", "0b10", "0o10"]) {
    assert.throws(() =>
      convertValue({
        sourceFormatId: "FP32",
        targetFormatId: "FP16",
        inputMode: "decimal",
        inputValue,
        roundingMode: "RNE",
      }),
    );
  }
});

test("rejects signed NaN spellings in decimal mode", () => {
  for (const inputValue of ["+nan", "-nan"]) {
    assert.throws(() =>
      convertValue({
        sourceFormatId: "FP32",
        targetFormatId: "FP16",
        inputMode: "decimal",
        inputValue,
        roundingMode: "RNE",
      }),
    );
  }
});

test("rejects binary input with the wrong width for the source format", () => {
  assert.throws(() =>
    convertValue({
      sourceFormatId: "FP32",
      targetFormatId: "FP16",
      inputMode: "binary",
      inputValue: "1",
      roundingMode: "RNE",
    }),
  );
});

test("rejects hex input with the wrong width for the source format", () => {
  assert.throws(() =>
    convertValue({
      sourceFormatId: "FP16",
      targetFormatId: "FP32",
      inputMode: "hex",
      inputValue: "0x1",
      roundingMode: "RNE",
    }),
  );
});
