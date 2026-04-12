import assert from "node:assert/strict";
import test from "node:test";

import type { CalculationRequest, ConversionRequest } from "../../src/core/model/conversion-request.js";
import {
  getCanonicalNaNUiState,
  getConversionRequestKey,
  getModeUiState,
  shouldRefreshPresets,
} from "../../src/ui/view-model.js";

test("refreshes presets on the first render", () => {
  assert.equal(
    shouldRefreshPresets(null, {
      sourceFormatId: "FP32",
      inputMode: "decimal",
    }),
    true,
  );
});

test("does not refresh presets when only input values change", () => {
  assert.equal(
    shouldRefreshPresets(
      {
        sourceFormatId: "FP32",
        inputMode: "hex",
      },
      {
        sourceFormatId: "FP32",
        inputMode: "hex",
      },
    ),
    false,
  );
});

test("refreshes presets when the source format changes", () => {
  assert.equal(
    shouldRefreshPresets(
      {
        sourceFormatId: "FP32",
        inputMode: "hex",
      },
      {
        sourceFormatId: "BF16",
        inputMode: "hex",
      },
    ),
    true,
  );
});

test("refreshes presets when the input mode changes", () => {
  assert.equal(
    shouldRefreshPresets(
      {
        sourceFormatId: "FP32",
        inputMode: "hex",
      },
      {
        sourceFormatId: "FP32",
        inputMode: "binary",
      },
    ),
    true,
  );
});

test("enables canonical NaN controls for float targets in canonical mode", () => {
  const state = getCanonicalNaNUiState("conversion", "BF16", "canonical", "0x7fc0");

  assert.equal(state.visible, true);
  assert.equal(state.enabled, true);
  assert.match(state.hint, /Default BF16 canonical NaN is 0x7fc0/);
});

test("disables canonical NaN controls in preserve mode", () => {
  const state = getCanonicalNaNUiState("conversion", "FP16", "preserve", "0x7e00");

  assert.equal(state.visible, true);
  assert.equal(state.enabled, false);
  assert.match(state.hint, /Switch NaN policy to canonical/);
});

test("disables canonical NaN controls for integer targets", () => {
  const state = getCanonicalNaNUiState("conversion", "INT32", "canonical", "");

  assert.equal(state.visible, true);
  assert.equal(state.enabled, false);
  assert.match(state.hint, /target formats that define NaN encodings/);
});

test("hides canonical NaN controls in inspection mode", () => {
  const state = getCanonicalNaNUiState("inspection", "BF16", "canonical", "0x7fc0");

  assert.equal(state.visible, false);
  assert.equal(state.enabled, false);
  assert.match(state.hint, /only in conversion mode/i);
});

test("inspection mode hides target controls and keeps rounding only for decimal input", () => {
  const decimalState = getModeUiState("inspection", "decimal");
  const hexState = getModeUiState("inspection", "hex");

  assert.equal(decimalState.showTargetControls, false);
  assert.equal(decimalState.showTargetPanel, false);
  assert.equal(decimalState.showRoundingControl, true);
  assert.match(decimalState.stageHeading, /Inspection Stage/);
  assert.equal(hexState.showRoundingControl, false);
});

test("conversion mode keeps target controls visible", () => {
  const state = getModeUiState("conversion", "binary");

  assert.equal(state.showTargetControls, true);
  assert.equal(state.showTargetPanel, true);
  assert.equal(state.showRoundingControl, true);
  assert.match(state.stageHeading, /Conversion Stages/);
});

test("conversion request key stays stable for identical requests", () => {
  const request: ConversionRequest = {
    mode: "conversion",
    sourceFormatId: "FP32",
    targetFormatId: "BF16",
    inputMode: "hex",
    inputValue: "0x7fc00000",
    roundingMode: "RNE",
    nanPolicy: "canonical",
    canonicalNaNInput: "0x7fc0",
  };

  assert.equal(getConversionRequestKey(request), getConversionRequestKey(request));
});

test("conversion request key changes when the effective input changes", () => {
  const baseRequest: ConversionRequest = {
    mode: "conversion",
    sourceFormatId: "FP32",
    targetFormatId: "BF16",
    inputMode: "hex",
    inputValue: "0x7fc00000",
    roundingMode: "RNE",
    nanPolicy: "canonical",
    canonicalNaNInput: "0x7fc0",
  };

  const changedRequest = {
    ...baseRequest,
    inputValue: "0x7fa00000",
  };

  assert.notEqual(getConversionRequestKey(baseRequest), getConversionRequestKey(changedRequest));
});

test("conversion request key changes when canonical NaN override changes", () => {
  const baseRequest: ConversionRequest = {
    mode: "conversion",
    sourceFormatId: "FP32",
    targetFormatId: "BF16",
    inputMode: "hex",
    inputValue: "0x7fc00000",
    roundingMode: "RNE",
    nanPolicy: "canonical",
    canonicalNaNInput: "0x7fc0",
  };

  const changedRequest = {
    ...baseRequest,
    canonicalNaNInput: "0x7f81",
  };

  assert.notEqual(getConversionRequestKey(baseRequest), getConversionRequestKey(changedRequest));
});

test("request key changes when mode changes", () => {
  const inspectionRequest: CalculationRequest = {
    mode: "inspection",
    sourceFormatId: "FP32",
    inputMode: "decimal",
    inputValue: "6.5",
    roundingMode: "RNE",
  };

  const conversionRequest: ConversionRequest = {
    ...inspectionRequest,
    mode: "conversion",
    targetFormatId: "FP16",
  };

  assert.notEqual(getConversionRequestKey(inspectionRequest), getConversionRequestKey(conversionRequest));
});
