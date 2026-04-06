import test from "node:test";
import assert from "node:assert/strict";

import { convertValue } from "../../src/core/convert/convert-value.js";

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
});

test("preserves signaling NaN for same-format raw fp32 conversion", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "FP32",
    inputMode: "hex",
    inputValue: "0x7fa00001",
    roundingMode: "RNE",
  });

  assert.equal(result.source.rawHex, "0x7fa00001");
  assert.equal(result.target.rawHex, "0x7fa00001");
  assert.equal(result.source.nanKind, "signaling");
  assert.equal(result.target.nanKind, "signaling");
  assert.equal(result.stages[1]?.valueChanged, false);
  assert.equal(result.warnings.length, 0);
});

test("preserves signaling NaN kind across fp32 to fp16 conversion", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "FP16",
    inputMode: "hex",
    inputValue: "0x7fa00001",
    roundingMode: "RNE",
  });

  assert.equal(result.source.nanKind, "signaling");
  assert.equal(result.target.classification, "NAN");
  assert.equal(result.target.nanKind, "signaling");
  assert.equal(result.target.rawHex, "0x7d00");
});

test("marks NaN representation changes as value-changing during cross-format conversion", () => {
  const result = convertValue({
    sourceFormatId: "FP32",
    targetFormatId: "BF16",
    inputMode: "hex",
    inputValue: "0x7fc12345",
    roundingMode: "RNE",
  });

  assert.equal(result.source.classification, "NAN");
  assert.equal(result.target.classification, "NAN");
  assert.equal(result.stages[1]?.stage, "source-to-target");
  assert.equal(result.stages[1]?.valueChanged, true);
  assert.equal(result.stages[1]?.roundingModeApplied, false);
  assert.match(result.stages[1]?.summary ?? "", /NaN representation changed/);
  assert.equal(result.warnings.length, 1);
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
