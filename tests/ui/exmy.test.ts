import assert from "node:assert/strict";
import test from "node:test";

import { buildExMyPresets, getExMyPresetHint } from "../../src/ui/exmy.js";

test("ExMy hex presets include dynamic NaN encodings for qNaN and sNaN", () => {
  const presets = buildExMyPresets(
    {
      hasSignBit: true,
      exponentBitCount: 5,
      mantissaBitCount: 2,
      supportsInfinity: true,
      supportsNaN: true,
    },
    "hex",
  );

  assert.deepEqual(
    presets.filter((preset) => preset.label === "qNaN" || preset.label === "sNaN"),
    [
      { label: "qNaN", value: "0x7e" },
      { label: "sNaN", value: "0x7d" },
    ],
  );
});

test("ExMy decimal presets omit negative zero when the sign bit is disabled", () => {
  const presets = buildExMyPresets(
    {
      hasSignBit: false,
      exponentBitCount: 4,
      mantissaBitCount: 3,
      supportsInfinity: true,
      supportsNaN: true,
    },
    "decimal",
  );

  assert.equal(presets.some((preset) => preset.label === "-0"), false);
});

test("ExMy presets keep the correct max normal when infinity is disabled but NaN remains enabled", () => {
  const presets = buildExMyPresets(
    {
      hasSignBit: true,
      exponentBitCount: 5,
      mantissaBitCount: 2,
      supportsInfinity: false,
      supportsNaN: true,
    },
    "hex",
  );

  assert.deepEqual(
    presets.find((preset) => preset.label === "max normal"),
    { label: "max normal", value: "0x7c" },
  );
});

test("ExMy presets keep the correct max normal when NaN is disabled but infinity remains enabled", () => {
  const presets = buildExMyPresets(
    {
      hasSignBit: true,
      exponentBitCount: 5,
      mantissaBitCount: 2,
      supportsInfinity: true,
      supportsNaN: false,
    },
    "hex",
  );

  assert.deepEqual(
    presets.find((preset) => preset.label === "max normal"),
    { label: "max normal", value: "0x7f" },
  );
});

test("ExMy preset hint includes the current runtime profile", () => {
  const hint = getExMyPresetHint(
    {
      hasSignBit: false,
      exponentBitCount: 4,
      mantissaBitCount: 3,
      supportsInfinity: false,
      supportsNaN: true,
    },
    "binary",
  );

  assert.match(hint, /ExMy \(S0 E4 M3\)/);
});
